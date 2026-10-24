/**
 * GET/POST /api/v1/cron/agenda-sem-confirmacao — o compromisso que se aproxima sem o cliente ter
 * respondido ao lembrete ganha uma tarefa para o responsável (ligar e confirmar).
 *
 * Quando faltam `HORAS_PARA_AVISAR_SEM_CONFIRMACAO` horas ou menos, com lembrete já enviado e sem
 * resposta. Uma vez por compromisso (`confirmation_alerted_at`). Não presume falta nem cancela nada.
 */
import { NextResponse, type NextRequest } from "next/server";

import { HORAS_PARA_AVISAR_SEM_CONFIRMACAO } from "@/lib/agenda/resposta-de-confirmacao";
import { autorizaCron } from "@/lib/auth/cron-auth";
import { logger } from "@/lib/logger";
import { idsDeOrgsParadas } from "@/lib/organizacao/operante";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarTarefaInterna } from "@/lib/tarefas/criar-tarefa";

export const dynamic = "force-dynamic";

async function executar(req: NextRequest) {
  if (!autorizaCron(req)) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "cron secret inválido" } },
      { status: 401 },
    );
  }
  const admin = createAdminClient();
  const agora = new Date();
  // Tipo com fluxo anti no-show: as horas são as do fluxo (nulo = não cria tarefa). Sem fluxo,
  // vale a regra de sempre. A janela da consulta é a maior das duas; o corte fino é por compromisso.
  const horasPorTipo = new Map<string, number | null>();
  const { data: ligacoes } = await admin
    .from("agenda_noshow_flow_types")
    .select("organization_id, event_type_id, flow_id")
    .limit(5000);
  if (ligacoes && ligacoes.length > 0) {
    const { data: fluxos } = await admin
      .from("agenda_noshow_flows")
      .select("id, call_hours_before")
      .limit(5000);
    const horasDoFluxo = new Map(
      ((fluxos ?? []) as Array<{ id: string; call_hours_before: number | null }>).map((f) => [
        f.id,
        f.call_hours_before,
      ]),
    );
    for (const l of ligacoes as Array<{ event_type_id: string; flow_id: string }>) {
      horasPorTipo.set(l.event_type_id, horasDoFluxo.get(l.flow_id) ?? null);
    }
  }
  const janelaEmHoras = Math.max(
    HORAS_PARA_AVISAR_SEM_CONFIRMACAO,
    ...[...horasPorTipo.values()].map((h) => h ?? 0),
  );
  const ate = new Date(agora.getTime() + janelaEmHoras * 3_600_000).toISOString();
  const { data, error } = await admin
    .from("calendar_appointments")
    .select(
      "id, organization_id, contact_id, owner_user_id, title, starts_at, time_zone, event_type_id",
    )
    .in("status", ["pending", "confirmed"])
    .is("client_confirmation", null)
    .is("confirmation_alerted_at", null)
    .not("contact_id", "is", null)
    .not("owner_user_id", "is", null)
    .not("reminder_sent_at", "is", null)
    .gt("starts_at", agora.toISOString())
    .lte("starts_at", ate)
    .order("starts_at", { ascending: true })
    .limit(500);
  if (error) {
    // Antes da migração a coluna não existe: sem trabalho, sem erro.
    return NextResponse.json({ data: { avisados: 0, motivo: "indisponivel" } });
  }
  // Empresa suspensa não recebe tarefa nova.
  const paradas = new Set(await idsDeOrgsParadas(admin));
  let avisados = 0;
  for (const a of (
    (data ?? []) as Array<{
      id: string;
      organization_id: string;
      contact_id: string;
      owner_user_id: string;
      title: string;
      starts_at: string;
      time_zone: string;
      event_type_id: string | null;
    }>
  ).filter((x) => {
    if (paradas.has(x.organization_id)) return false;
    const horas =
      x.event_type_id && horasPorTipo.has(x.event_type_id)
        ? horasPorTipo.get(x.event_type_id)!
        : HORAS_PARA_AVISAR_SEM_CONFIRMACAO;
    if (horas === null) return false;
    return new Date(x.starts_at).getTime() - agora.getTime() <= horas * 3_600_000;
  })) {
    // Marca primeiro: duas rodadas concorrentes não criam duas tarefas.
    const { data: marcado } = await admin
      .from("calendar_appointments")
      .update({ confirmation_alerted_at: agora.toISOString() })
      .eq("organization_id", a.organization_id)
      .eq("id", a.id)
      .is("confirmation_alerted_at", null)
      .select("id")
      .maybeSingle();
    if (!marcado) continue;
    const hora = new Intl.DateTimeFormat("pt-BR", {
      timeZone: a.time_zone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(a.starts_at));
    const r = await criarTarefaInterna(admin, {
      organizationId: a.organization_id,
      titulo: `Sem confirmação: ${a.title} às ${hora} — ligar para o cliente`,
      venceEmDias: 0,
      atribuirA: { usuario_id: a.owner_user_id },
      prioridade: "high",
      contactId: a.contact_id,
      descricao:
        "O cliente recebeu o lembrete e não respondeu. Confirme a presença antes do horário.",
      origem: "agenda:sem_confirmacao",
    }).catch((e: unknown) => {
      logger.error("[agenda-sem-confirmacao] tarefa não criada", {
        erro: e instanceof Error ? e.message : String(e),
      });
      return null;
    });
    if (r?.ok) avisados += 1;
  }
  return NextResponse.json({ data: { avisados } });
}

export const GET = executar;
export const POST = executar;
