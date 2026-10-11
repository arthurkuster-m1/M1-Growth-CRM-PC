/**
 * POST /api/v1/marketing/cronograma/tarefas — põe uma tarefa na semana do cliente: inclui uma
 * que já existe na base (`id`) ou cria uma nova (`title`), com o lado (agência ou cliente).
 */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import {
  COLUNAS_DA_TAREFA_NO_CRONOGRAMA,
  novaTarefaSchema,
  tarefaDoCronograma,
} from "@/lib/marketing/cronograma";
import { autorizarCronograma } from "@/lib/marketing/cronograma-servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCronograma("manager", true);
  if (!a.ok) return a.response;
  const corpo = novaTarefaSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success || (!corpo.data.id && !corpo.data.title)) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }

  const consulta = corpo.data.id
    ? a.supabase
        .from("crm_tasks")
        .update({
          cronograma_lado: corpo.data.lado,
          ...(corpo.data.due_date !== undefined ? { due_date: corpo.data.due_date } : {}),
        })
        .eq("id", corpo.data.id)
        .eq("organization_id", a.orgId)
    : a.supabase.from("crm_tasks").insert({
        organization_id: a.orgId,
        title: corpo.data.title!,
        due_date: corpo.data.due_date ?? null,
        cronograma_lado: corpo.data.lado,
        created_by: a.userId,
      });
  const { data, error } = await consulta.select(COLUNAS_DA_TAREFA_NO_CRONOGRAMA).maybeSingle();
  if (error)
    return fail("internal_error", a.t("Erro ao salvar a tarefa."), 500, { requestId: a.requestId });
  if (!data)
    return fail("not_found", a.t("Tarefa não encontrada."), 404, { requestId: a.requestId });

  await audit({
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: "marketing_cronograma.task_added",
    resourceType: "crm_tasks",
    resourceId: (data as { id: string }).id,
    requestId: a.requestId,
    metadata: { lado: corpo.data.lado, nova: !corpo.data.id },
  });
  return ok(
    { tarefa: tarefaDoCronograma(data as Parameters<typeof tarefaDoCronograma>[0]) },
    { requestId: a.requestId, status: 201 },
  );
}
