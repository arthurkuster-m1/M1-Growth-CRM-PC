import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/tasks/[id]/timer — o cronômetro da tarefa (como no ClickUp).
 *
 *   { acao: "iniciar" } começa a contar o tempo da pessoa nesta tarefa, passa a tarefa para
 *                       "Em andamento" (e fecha o cronômetro que ela tinha rodando em outra:
 *                       um por pessoa);
 *   { acao: "parar" }   fecha o lançamento em andamento. Menos de 5 segundos é engano: o
 *                       lançamento é cancelado (e o status volta ao de antes); de 5 s para cima
 *                       o tempo conta.
 *
 * Devolve o tempo da tarefa: o total já fechado e quem está cronometrando agora. A regra mora no
 * banco (migration 0689): `fn_tarefa_timer_iniciar/parar`, `security invoker` — a RLS de quem
 * chama continua valendo e o relógio é o do banco, não o do navegador. Atendente em diante.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { temposDaTarefa } from "@/lib/tarefas/tempo";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({ acao: z.enum(["iniciar", "parar"]) });

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: Contexto): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_tasks" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", t("Tarefa não encontrada."), 404, { requestId });
  }
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const orgId = authz.org.orgId;
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    corpo.data.acao === "iniciar" ? "fn_tarefa_timer_iniciar" : "fn_tarefa_timer_parar",
    { p_task: id, p_organization_id: orgId },
  );
  if (error) {
    if (error.code === "42501") {
      return fail("forbidden", t("Você não tem permissão para cronometrar tarefas."), 403, {
        requestId,
      });
    }
    if (error.code === "P0002")
      return fail("not_found", t("Tarefa não encontrada."), 404, { requestId });
    if (error.code === "P0001") {
      return fail(
        "conflict",
        t("Esta tarefa já está concluída ou cancelada: reabra-a para cronometrar."),
        409,
        { requestId },
      );
    }
    if (error.code === "23505") {
      return fail("conflict", t("O cronômetro já estava rodando. Atualize a tela."), 409, {
        requestId,
      });
    }
    return fail("internal_error", t("Erro ao salvar o cronômetro."), 500, { requestId });
  }

  await audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: corpo.data.acao === "iniciar" ? "crm_task.timer_started" : "crm_task.timer_stopped",
    resourceType: "crm_tasks",
    resourceId: id,
    requestId,
  });

  return ok({ task_id: id, ...(await temposDaTarefa(supabase, orgId, id)) }, { requestId });
}
