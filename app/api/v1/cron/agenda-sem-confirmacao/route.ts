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
  const ate = new Date(agora.getTime() + HORAS_PARA_AVISAR_SEM_CONFIRMACAO * 3_600_000).toISOString();
  const { data, error } = await admin
    .from("calendar_appointments")
    .select("id, organization_id, contact_id, owner_user_id, title, starts_at, time_zone")
    .in("status", ["pending", "confirmed"])
    .is("client_confirmation", null)
    .is("confirmation_alerted_at", null)
    .not("contact_id", "is", null)
    .not("owner_user_id", "is", null)
    .not("reminder_sent_at", "is", null)
    .gt("starts_at", agora.toISOString())
    .lte("starts_at", ate)
    .limit(200);
  if (error) {
    // Antes da migração a coluna não existe: sem trabalho, sem erro.
    return NextResponse.json({ data: { avisados: 0, motivo: "indisponivel" } });
  }
  let avisados = 0;
  for (const a of (data ?? []) as Array<{
    id: string;
    organization_id: string;
    contact_id: string;
    owner_user_id: string;
    title: string;
    starts_at: string;
    time_zone: string;
  }>) {
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
      descricao: "O cliente recebeu o lembrete e não respondeu. Confirme a presença antes do horário.",
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
