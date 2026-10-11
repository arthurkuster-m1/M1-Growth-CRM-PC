/**
 * POST /api/v1/marketing/cronograma/fechar-semana — fecha a semana: para cada tarefa aberta, a
 * agência decide concluir, adiar (nova data + MOTIVO), manter ou cancelar. Cada decisão vira uma
 * linha de `fechamento_da_semana` no histórico, com o motivo — é o "por que" que fica guardado.
 */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { fechamentoSchema } from "@/lib/marketing/cronograma";
import { autorizarCronograma } from "@/lib/marketing/cronograma-servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCronograma("manager", true);
  if (!a.ok) return a.response;
  const corpo = fechamentoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success)
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  const { inicio, decisoes } = corpo.data;

  let aplicadas = 0;
  for (const d of decisoes) {
    if (d.acao === "adiar" && !d.novo_prazo) continue;
    if ((d.acao === "adiar" || d.acao === "cancelar") && !(d.motivo ?? "").trim()) continue;

    if (d.acao === "adiar") {
      const { error } = await a.supabase.rpc("fn_cronograma_mudar_prazo", {
        p_task: d.task_id,
        p_novo: d.novo_prazo!,
        p_motivo: d.motivo ?? "",
      });
      if (error) continue;
    } else if (d.acao === "concluir" || d.acao === "cancelar") {
      const { error } = await a.supabase
        .from("crm_tasks")
        .update({ status: d.acao === "concluir" ? "done" : "cancelled" })
        .eq("id", d.task_id)
        .eq("organization_id", a.orgId);
      if (error) continue;
    }

    const { data: tarefa } = await a.supabase
      .from("crm_tasks")
      .select("due_date, status")
      .eq("id", d.task_id)
      .eq("organization_id", a.orgId)
      .maybeSingle();
    if (!tarefa) continue;
    await a.supabase.from("crm_task_historico").insert({
      organization_id: a.orgId,
      task_id: d.task_id,
      tipo: "fechamento_da_semana",
      para_prazo: (tarefa as { due_date: string | null }).due_date,
      situacao: `${d.acao}:${(tarefa as { status: string }).status}`,
      motivo: (d.motivo ?? "").trim() || null,
      semana_inicio: inicio,
      autor: a.userId,
    });
    aplicadas += 1;
  }

  await audit({
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: "marketing_cronograma.week_closed",
    resourceType: "marketing_cronograma",
    resourceId: null,
    requestId: a.requestId,
    metadata: { inicio, decisoes: decisoes.length, aplicadas },
  });
  return ok({ aplicadas }, { requestId: a.requestId });
}
