import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET  /api/v1/tasks/properties — as propriedades personalizadas das tarefas da organização.
 * POST /api/v1/tasks/properties — cria uma propriedade.
 *
 * As colunas que a organização inventa ("Cliente", "Canal", "Valor", "Entregue?"). A
 * DEFINIÇÃO mora em `crm_task_properties`; o valor de cada tarefa, em
 * `crm_tasks.custom_fields` (migration 0584). O tipo é escolhido aqui e não muda mais:
 * trocar "número" por "data" reinterpretaria o valor de todas as tarefas.
 *
 * Leitura a partir de `viewer` (a tabela precisa dos nomes e das opções para desenhar as
 * colunas); escrita a partir de `manager`, como as opções de status.
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
  TIPOS_COM_OPCOES,
  TIPOS_DE_PROPRIEDADE,
  opcoesDePropriedadeSchema,
  type PropriedadeDaTarefa,
} from "@/lib/tarefas/propriedades";

export const dynamic = "force-dynamic";

const COLUNAS = "id, organization_id, name, type, options, position";

/** Poucas, de propósito: uma tabela com 80 colunas não é uma tabela, e cada uma pesa em toda linha. */
const MAXIMO_DE_PROPRIEDADES = 40;

const criacaoSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    type: z.enum(TIPOS_DE_PROPRIEDADE),
    options: opcoesDePropriedadeSchema.default([]),
  })
  .refine((v) => v.options.length === 0 || TIPOS_COM_OPCOES.includes(v.type), {
    message: "Só as propriedades de seleção têm opções.",
    path: ["options"],
  });

export async function GET(): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("viewer", { requestId, resource: "crm_task_properties" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_task_properties")
    .select(COLUNAS)
    .eq("organization_id", authz.org.orgId)
    .order("position", { ascending: true })
    .limit(200);

  if (error) {
    return fail("internal_error", t("Erro ao listar as propriedades."), 500, { requestId });
  }
  return ok({ properties: (data ?? []) as unknown as PropriedadeDaTarefa[] }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

  const authz = await requireRole("manager", { requestId, resource: "crm_task_properties" });
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

  const { count } = await supabase
    .from("crm_task_properties")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", authz.org.orgId);
  if ((count ?? 0) >= MAXIMO_DE_PROPRIEDADES) {
    return fail("validation_failed", t("Limite de propriedades atingido."), 422, { requestId });
  }

  const { data, error } = await supabase
    .from("crm_task_properties")
    .insert({ ...parsed.data, organization_id: authz.org.orgId })
    .select(COLUNAS)
    .single();

  if (error) {
    // 23505 = o índice único (organização + nome sem caixa).
    if (error.code === "23505") {
      return fail("conflict", t("Já existe uma propriedade com esse nome."), 409, { requestId });
    }
    return fail("internal_error", t("Erro ao salvar a propriedade."), 500, { requestId });
  }

  const propriedade = data as unknown as PropriedadeDaTarefa;

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task_property.created",
    resourceType: "crm_task_properties",
    resourceId: propriedade.id,
    requestId,
    metadata: { name: propriedade.name, type: propriedade.type },
  });

  return ok({ property: propriedade }, { requestId, status: 201 });
}
