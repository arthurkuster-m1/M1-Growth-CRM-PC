import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET  /api/v1/tasks/status-options — as opções de status das tarefas da organização.
 * POST /api/v1/tasks/status-options — cria uma opção.
 *
 * O "Status" do Notion: nome e cor livres. Cada opção pertence a um GRUPO
 * (`pending`, `in_progress`, `done`, `cancelled`), que é o `crm_tasks.status` que as
 * telas antigas ainda leem — ver a migration 0582.
 *
 * Leitura a partir de `viewer` (todo mundo precisa ver o nome da opção na tabela);
 * escrita a partir de `manager`, porque mudar o vocabulário de status é configurar a
 * operação, e não o gesto diário de quem atende. A policy do banco cobra o mesmo.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import {
  CORES_DA_OPCAO,
  GRUPOS_DA_OPCAO,
  type OpcaoDeStatus,
} from "@/lib/tarefas/opcoes-de-status";

export const dynamic = "force-dynamic";

const COLUNAS = "id, organization_id, name, color, grupo, position";

const criacaoSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.enum(CORES_DA_OPCAO).default("gray"),
  grupo: z.enum(GRUPOS_DA_OPCAO).default("pending"),
});

export async function GET(): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("viewer", { requestId, resource: "crm_task_status_options" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_task_status_options")
    .select(COLUNAS)
    .eq("organization_id", authz.org.orgId)
    .order("position", { ascending: true })
    .limit(200);

  if (error) {
    return fail("internal_error", t("Erro ao listar as opções de status."), 500, { requestId });
  }
  return ok({ options: (data ?? []) as unknown as OpcaoDeStatus[] }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

  const authz = await requireRole("manager", { requestId, resource: "crm_task_status_options" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = criacaoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_task_status_options")
    .insert({ ...parsed.data, organization_id: authz.org.orgId })
    .select(COLUNAS)
    .single();

  if (error) {
    // 23505 = o índice único (organização + nome sem caixa): já existe uma opção assim.
    if (error.code === "23505") {
      return fail("conflict", t("Já existe uma opção com esse nome."), 409, { requestId });
    }
    return fail("internal_error", t("Erro ao salvar a opção de status."), 500, { requestId });
  }

  const opcao = data as unknown as OpcaoDeStatus;

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task_status_option.created",
    resourceType: "crm_task_status_options",
    resourceId: opcao.id,
    requestId,
    metadata: { name: opcao.name, grupo: opcao.grupo },
  });

  return ok({ option: opcao }, { requestId, status: 201 });
}
