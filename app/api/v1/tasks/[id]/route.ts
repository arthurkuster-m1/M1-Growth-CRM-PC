import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PATCH  /api/v1/tasks/[id] — edita uma tarefa.
 * DELETE /api/v1/tasks/[id] — apaga uma tarefa.
 *
 * Extraído do PR #418 (@clinicacentrodosorrisosc-code), sem o fallback para
 * `custom_fields.tasks` — o motivo inteiro está no cabeçalho de
 * `app/api/v1/tasks/route.ts`.
 *
 * ⚠️ O `.eq("organization_id", ...)` não é decoração: sem ele o PATCH casaria
 * 0 linhas numa tarefa de outra organização e o PostgREST devolveria `PGRST116`
 * — que esta rota já traduz para 404, o desfecho certo. Mantê-lo explícito é a
 * regra do CLAUDE.md e o que segura o dia em que alguém trocar o client.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { registraAtividadeDaTarefa } from "@/lib/tarefas/atividade";
import {
  alteracoesDeCamposSchema,
  mesclarCamposPersonalizados,
  type PropriedadeDaTarefa,
} from "@/lib/tarefas/propriedades";
import { PRIORIDADES_DA_TAREFA, SITUACOES_DA_TAREFA, type Tarefa } from "@/lib/tarefas/tipos";

export const dynamic = "force-dynamic";

const COLUNAS =
  "id, organization_id, title, description, due_date, start_date, priority, status, lead_id, contact_id, assigned_to, created_by, created_at, updated_at, status_option_id, position, custom_fields, cronograma_lado";

const edicaoSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(5000).nullable().optional(),
    due_date: z.string().datetime({ offset: true }).nullable().optional(),
    start_date: z.string().datetime({ offset: true }).nullable().optional(),
    priority: z.enum(PRIORIDADES_DA_TAREFA).optional(),
    status: z.enum(SITUACOES_DA_TAREFA).optional(),
    lead_id: z.string().uuid().nullable().optional(),
    contact_id: z.string().uuid().nullable().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    status_option_id: z.string().uuid().nullable().optional(),
    position: z.number().finite().optional(),
    // Quem faz a tarefa no cronograma do cliente; `null` tira do cronograma. Só gerente+.
    cronograma_lado: z.enum(["agencia", "cliente"]).nullable().optional(),
    // Só as propriedades que mudam (id → valor, `null` limpa). A rota valida cada valor
    // contra o tipo da propriedade e mescla com o que a tarefa já tem (migration 0584).
    custom_fields: alteracoesDeCamposSchema.optional(),
  })
  // PATCH vazio gravaria só o `updated_at` e devolveria 200: a tela diria
  // "salvo" sobre uma edição que não existiu.
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("agent", { requestId, resource: "crm_tasks" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = edicaoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  // Pôr a tarefa no cronograma do cliente (ou tirá-la) é decisão de gestão.
  if (parsed.data.cronograma_lado !== undefined && !roleAtLeast(authz.org.role, "manager")) {
    return fail("forbidden", t("Só a gestão define o cronograma da tarefa."), 403, { requestId });
  }

  const supabase = await createClient();

  // A situação ANTES da edição decide se esta é a vez em que a tarefa fechou.
  // Sem ler antes, marcar "concluída" duas vezes emitiria duas linhas na
  // timeline do negócio — e a segunda seria mentira.
  const { data: antes } = await supabase
    .from("crm_tasks")
    .select("status, custom_fields")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();

  // `custom_fields` chega como ALTERAÇÕES e vai para o banco já MESCLADO. Só chaves de
  // propriedades que existem NESTA organização entram, e cada valor é conferido contra o
  // tipo — um id forjado ou um texto numa coluna de número é recusado antes de gravar.
  const atualizacao: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.custom_fields) {
    if (!antes) return fail("not_found", t("Tarefa não encontrada."), 404, { requestId });
    const { data: definicoes } = await supabase
      .from("crm_task_properties")
      .select("id, organization_id, name, type, options, position")
      .eq("organization_id", authz.org.orgId);
    const mesclado = mesclarCamposPersonalizados(
      (antes as { custom_fields?: Record<string, unknown> }).custom_fields ?? {},
      parsed.data.custom_fields,
      (definicoes ?? []) as unknown as PropriedadeDaTarefa[],
    );
    if (!mesclado.ok) {
      return fail("validation_failed", t(mesclado.erro), 422, {
        requestId,
        details: { custom_fields: [mesclado.erro], propriedade: mesclado.propriedadeId },
      });
    }
    atualizacao.custom_fields = mesclado.campos;
  }

  const { data, error } = await supabase
    .from("crm_tasks")
    .update(atualizacao)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select(COLUNAS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return fail("not_found", t("Tarefa não encontrada."), 404, { requestId });
    }
    if (error.code === "23503") {
      return fail("validation_failed", t("O negócio ou contato vinculado não existe."), 422, {
        requestId,
      });
    }
    return fail("internal_error", t("Erro ao salvar a tarefa."), 500, { requestId });
  }

  const tarefa = data as unknown as Tarefa;

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task.updated",
    resourceType: "crm_tasks",
    resourceId: tarefa.id,
    requestId,
    metadata: { campos: Object.keys(parsed.data) },
  });

  const fechouAgora =
    tarefa.status === "done" && (antes as { status?: string } | null)?.status !== "done";
  if (fechouAgora) {
    await registraAtividadeDaTarefa(supabase, {
      organizationId: authz.org.orgId,
      tarefa,
      tipo: "task_completed",
      actor: { type: "user", id: authz.user.id },
    });
  }

  return ok({ task: tarefa }, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("agent", { requestId, resource: "crm_tasks" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  // `.select()` no delete para saber se ALGUMA linha saiu. Sem isso, apagar uma
  // tarefa de outra organização devolveria 200 — e a tela sumiria com a linha
  // do próprio usuário na próxima recarga, sem que nada tivesse sido apagado.
  const { data, error } = await supabase
    .from("crm_tasks")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id");

  if (error) {
    return fail("internal_error", t("Erro ao apagar a tarefa."), 500, { requestId });
  }
  if (!data || data.length === 0) {
    return fail("not_found", t("Tarefa não encontrada."), 404, { requestId });
  }

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task.deleted",
    resourceType: "crm_tasks",
    resourceId: id,
    requestId,
  });

  return ok({ deleted: true }, { requestId });
}
