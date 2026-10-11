/**
 * PATCH /api/v1/marketing/cronograma/tarefas/[id] — muda o lado, o prazo (com o MOTIVO, que
 * vai para o histórico) ou a situação de uma tarefa do cronograma. `lado: null` tira da semana.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import {
  COLUNAS_DA_TAREFA_NO_CRONOGRAMA,
  edicaoDeTarefaSchema,
  tarefaDoCronograma,
} from "@/lib/marketing/cronograma";
import { autorizarCronograma, naoEncontrado } from "@/lib/marketing/cronograma-servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCronograma("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return naoEncontrado(a.t, a.requestId);
  const corpo = edicaoDeTarefaSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success)
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  const { lado, due_date, status, motivo } = corpo.data;

  // O prazo passa pela função que anota o motivo no histórico (a RLS de quem chama vale).
  if (due_date !== undefined) {
    const { error } = await a.supabase.rpc("fn_cronograma_mudar_prazo", {
      p_task: id,
      p_novo: due_date,
      p_motivo: motivo ?? "",
    });
    if (error)
      return fail("internal_error", a.t("Erro ao salvar a tarefa."), 500, {
        requestId: a.requestId,
      });
  }

  const mudancas: Record<string, unknown> = {};
  if (lado !== undefined) mudancas.cronograma_lado = lado;
  if (status !== undefined) mudancas.status = status;
  if (Object.keys(mudancas).length > 0) {
    const { error } = await a.supabase
      .from("crm_tasks")
      .update(mudancas)
      .eq("id", id)
      .eq("organization_id", a.orgId);
    if (error)
      return fail("internal_error", a.t("Erro ao salvar a tarefa."), 500, {
        requestId: a.requestId,
      });
  }

  const { data } = await a.supabase
    .from("crm_tasks")
    .select(COLUNAS_DA_TAREFA_NO_CRONOGRAMA)
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!data) return naoEncontrado(a.t, a.requestId);
  return ok(
    { tarefa: tarefaDoCronograma(data as Parameters<typeof tarefaDoCronograma>[0]) },
    { requestId: a.requestId },
  );
}
