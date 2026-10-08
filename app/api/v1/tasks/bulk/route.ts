import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PATCH  /api/v1/tasks/bulk — muda status, prioridade, responsável ou prazo de várias tarefas.
 * DELETE /api/v1/tasks/bulk — apaga várias tarefas.
 *
 * Uma requisição, e não N: a tela seleciona 30 linhas e aplica uma mudança; 30 PATCHes
 * seriam 30 idas ao banco e 30 recargas da lista. Aqui é UM `update ... where id in (...)`.
 *
 * As mesmas travas da rota individual (`/tasks/[id]`):
 *  - `agent` ou acima, e `requireSupportWrite()` antes de qualquer efeito;
 *  - `organization_id` sempre da sessão e SEMPRE no filtro — uma lista de ids de outra
 *    organização atualiza zero linhas, em vez de atravessar a fronteira;
 *  - o `status` não é gravado à mão: quem escolhe é a OPÇÃO, e o trigger do banco (0582)
 *    deriva o status do grupo dela.
 *
 * O que muda aqui e não na individual: a timeline do negócio. Cada tarefa que ESTE pedido
 * fechou ganha a sua linha "tarefa concluída" — e só as que não estavam fechadas antes.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { registraAtividadeDaTarefa } from "@/lib/tarefas/atividade";
import { edicaoEmMassaSchema, exclusaoEmMassaSchema } from "@/lib/tarefas/edicao-em-massa";
import type { Tarefa } from "@/lib/tarefas/tipos";

export const dynamic = "force-dynamic";

const COLUNAS =
  "id, organization_id, title, description, due_date, priority, status, lead_id, contact_id, assigned_to, created_by, created_at, updated_at, status_option_id, position, custom_fields";

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

  const authz = await requireRole("agent", { requestId, resource: "crm_tasks" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = edicaoEmMassaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }
  const { ids, changes } = parsed.data;

  const supabase = await createClient();

  // Uma opção de OUTRA organização (o FK sozinho não impede) é recusada aqui, com mensagem;
  // o trigger do banco a ignoraria em silêncio, e a pessoa acharia que mudou.
  if (changes.status_option_id) {
    const { data: opcao } = await supabase
      .from("crm_task_status_options")
      .select("id")
      .eq("id", changes.status_option_id)
      .eq("organization_id", authz.org.orgId)
      .maybeSingle();
    if (!opcao) {
      return fail("validation_failed", t("Opção não encontrada."), 422, { requestId });
    }
  }

  // A situação ANTES decide quais tarefas fecharam agora (ver o cabeçalho).
  const { data: antes } = await supabase
    .from("crm_tasks")
    .select("id, status")
    .in("id", ids)
    .eq("organization_id", authz.org.orgId);
  const jaFechadas = new Set(
    ((antes ?? []) as { id: string; status: string }[])
      .filter((x) => x.status === "done")
      .map((x) => x.id),
  );

  const { data, error } = await supabase
    .from("crm_tasks")
    .update(changes)
    .in("id", ids)
    .eq("organization_id", authz.org.orgId)
    .select(COLUNAS);

  if (error) {
    return fail("internal_error", t("Erro ao salvar as tarefas."), 500, { requestId });
  }

  const atualizadas = (data ?? []) as unknown as Tarefa[];

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task.bulk_updated",
    resourceType: "crm_tasks",
    // Sem um id só: o recurso é "um conjunto". A lista de ids ficaria cara e ilegível no log.
    resourceId: null,
    requestId,
    metadata: { total: atualizadas.length, campos: Object.keys(changes) },
  });

  for (const tarefa of atualizadas) {
    if (tarefa.status === "done" && !jaFechadas.has(tarefa.id)) {
      await registraAtividadeDaTarefa(supabase, {
        organizationId: authz.org.orgId,
        tarefa,
        tipo: "task_completed",
        actor: { type: "user", id: authz.user.id },
      });
    }
  }

  return ok({ updated: atualizadas.length, tasks: atualizadas }, { requestId });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

  const authz = await requireRole("agent", { requestId, resource: "crm_tasks" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = exclusaoEmMassaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const supabase = await createClient();
  // `.select()` no delete para saber QUANTAS saíram (mesma razão de /tasks/[id]).
  const { data, error } = await supabase
    .from("crm_tasks")
    .delete()
    .in("id", parsed.data.ids)
    .eq("organization_id", authz.org.orgId)
    .select("id");

  if (error) {
    return fail("internal_error", t("Erro ao apagar as tarefas."), 500, { requestId });
  }

  const apagadas = data?.length ?? 0;
  if (apagadas === 0) {
    return fail("not_found", t("Tarefa não encontrada."), 404, { requestId });
  }

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task.bulk_deleted",
    resourceType: "crm_tasks",
    resourceId: null,
    requestId,
    metadata: { total: apagadas },
  });

  return ok({ deleted: apagadas }, { requestId });
}
