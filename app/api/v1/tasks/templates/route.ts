import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET  /api/v1/tasks/templates — os modelos de tarefa da organização.
 * POST /api/v1/tasks/templates — cria um modelo (e, se ele repete, agenda a 1ª criação).
 *
 * Um modelo é a tarefa "de molde" (título, prioridade, status, responsável, início e prazo
 * relativos). Se `repeat_enabled`, o agendador (`/api/v1/cron/tarefas-repetidas`) cria a
 * tarefa sozinho a cada ocorrência (migration 0586).
 *
 * Leitura a partir de `viewer`; criar e editar a partir de `agent`, o mesmo corte de editar
 * as tarefas. A organização vem SEMPRE da sessão, nunca do corpo.
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
  MAXIMO_DE_MODELOS,
  modeloSchema,
  proximaExecucao,
  type ModeloDeTarefa,
} from "@/lib/tarefas/modelos";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("viewer", { requestId, resource: "crm_task_templates" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_task_templates")
    .select(COLUNAS_DO_MODELO)
    .eq("organization_id", authz.org.orgId)
    .order("position", { ascending: true })
    .limit(MAXIMO_DE_MODELOS + 20);

  if (error) {
    return fail("internal_error", t("Erro ao listar os modelos."), 500, { requestId });
  }
  return ok({ templates: (data ?? []) as unknown as ModeloDeTarefa[] }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

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

  const { count } = await supabase
    .from("crm_task_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", authz.org.orgId);
  if ((count ?? 0) >= MAXIMO_DE_MODELOS) {
    return fail("validation_failed", t("Limite de modelos atingido."), 422, { requestId });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  const fuso = (org as { timezone?: string } | null)?.timezone || "America/Sao_Paulo";
  const proxima = proximaExecucao(parsed.data, new Date(), fuso);

  const { data, error } = await supabase
    .from("crm_task_templates")
    .insert({
      ...parsed.data,
      next_run_at: proxima ? proxima.toISOString() : null,
      organization_id: authz.org.orgId,
      created_by: authz.user.id,
    })
    .select(COLUNAS_DO_MODELO)
    .single();

  if (error) {
    // 23503 = a opção de status é de outra organização (ou foi apagada no meio).
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
    action: "crm_task_template.created",
    resourceType: "crm_task_templates",
    resourceId: modelo.id,
    requestId,
    metadata: { name: modelo.name, repete: modelo.repeat_enabled },
  });

  return ok({ template: modelo }, { requestId, status: 201 });
}
