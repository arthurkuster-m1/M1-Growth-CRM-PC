import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PATCH  /api/v1/tasks/templates/[id] — edita o modelo (a tela manda o modelo inteiro).
 * DELETE /api/v1/tasks/templates/[id] — apaga o modelo; as tarefas que ele já criou ficam.
 *
 * A próxima ocorrência (`next_run_at`) é recalculada AQUI quando a regra de repetição
 * mudou — a tela nunca a manda. Se a regra não mudou, ela é mantida: salvar só o título
 * não pode empurrar para frente uma ocorrência que está para vencer.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import {
  COLUNAS_DO_MODELO,
  modeloSchema,
  proximaExecucao,
  type ModeloDeTarefa,
} from "@/lib/tarefas/modelos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

const mesmaRegra = (a: ModeloDeTarefa, b: ReturnType<typeof modeloSchema.parse>) =>
  a.repeat_enabled === b.repeat_enabled &&
  a.repeat_frequency === (b.repeat_frequency ?? null) &&
  a.repeat_time === b.repeat_time &&
  a.repeat_day_of_month === (b.repeat_day_of_month ?? null) &&
  JSON.stringify(a.repeat_weekdays) === JSON.stringify(b.repeat_weekdays);

export async function PATCH(req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("agent", { requestId, resource: "crm_task_templates" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = modeloSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("crm_task_templates")
    .select(COLUNAS_DO_MODELO)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!atual) return fail("not_found", t("Modelo não encontrado."), 404, { requestId });
  const antes = atual as unknown as ModeloDeTarefa;

  let proxima = antes.next_run_at;
  if (!mesmaRegra(antes, parsed.data) || (parsed.data.repeat_enabled && !antes.next_run_at)) {
    const { data: org } = await supabase
      .from("organizations")
      .select("timezone")
      .eq("id", authz.org.orgId)
      .maybeSingle();
    const fuso = (org as { timezone?: string } | null)?.timezone || "America/Sao_Paulo";
    proxima = proximaExecucao(parsed.data, new Date(), fuso)?.toISOString() ?? null;
  }
  if (!parsed.data.repeat_enabled) proxima = null;

  const { data, error } = await supabase
    .from("crm_task_templates")
    .update({ ...parsed.data, next_run_at: proxima })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select(COLUNAS_DO_MODELO)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return fail("not_found", t("Modelo não encontrado."), 404, { requestId });
    }
    if (error.code === "23503") {
      return fail("validation_failed", t("O status ou o responsável escolhido não existe."), 422, {
        requestId,
      });
    }
    return fail("internal_error", t("Erro ao salvar o modelo."), 500, { requestId });
  }

  const modelo = data as unknown as ModeloDeTarefa;

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task_template.updated",
    resourceType: "crm_task_templates",
    resourceId: modelo.id,
    requestId,
    metadata: { name: modelo.name, repete: modelo.repeat_enabled },
  });

  return ok({ template: modelo }, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("agent", { requestId, resource: "crm_task_templates" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_task_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id");

  if (error) {
    return fail("internal_error", t("Erro ao apagar o modelo."), 500, { requestId });
  }
  if (!data || data.length === 0) {
    return fail("not_found", t("Modelo não encontrado."), 404, { requestId });
  }

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task_template.deleted",
    resourceType: "crm_task_templates",
    resourceId: id,
    requestId,
  });

  return ok({ deleted: true }, { requestId });
}
