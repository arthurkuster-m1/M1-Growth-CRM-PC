import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PATCH  /api/v1/tasks/properties/[id] — renomeia, edita as opções ou reordena.
 * DELETE /api/v1/tasks/properties/[id] — apaga a propriedade e os valores dela nas tarefas.
 *
 * O TIPO não muda: trocar "número" por "data" reinterpretaria o valor de todas as
 * tarefas. Quem quer outro tipo cria outra propriedade.
 *
 * Tirar uma opção de uma seleção NÃO apaga o valor das tarefas que a usavam: a tela
 * ignora o id que não existe mais, e se a opção voltar (mesmo id) o valor volta junto.
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
  opcoesDePropriedadeSchema,
  type PropriedadeDaTarefa,
} from "@/lib/tarefas/propriedades";

export const dynamic = "force-dynamic";

const COLUNAS = "id, organization_id, name, type, options, position";

const edicaoSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    options: opcoesDePropriedadeSchema.optional(),
    position: z.number().finite().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("manager", { requestId, resource: "crm_task_properties" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = edicaoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const supabase = await createClient();

  // Opções só fazem sentido numa seleção.
  if (parsed.data.options) {
    const { data: atual } = await supabase
      .from("crm_task_properties")
      .select("type")
      .eq("id", id)
      .eq("organization_id", authz.org.orgId)
      .maybeSingle();
    const tipo = (atual as { type?: string } | null)?.type;
    if (!tipo) return fail("not_found", t("Propriedade não encontrada."), 404, { requestId });
    if (!TIPOS_COM_OPCOES.includes(tipo as (typeof TIPOS_COM_OPCOES)[number])) {
      return fail("validation_failed", t("Só as propriedades de seleção têm opções."), 422, {
        requestId,
      });
    }
  }

  const { data, error } = await supabase
    .from("crm_task_properties")
    .update(parsed.data)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select(COLUNAS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return fail("not_found", t("Propriedade não encontrada."), 404, { requestId });
    }
    if (error.code === "23505") {
      return fail("conflict", t("Já existe uma propriedade com esse nome."), 409, { requestId });
    }
    return fail("internal_error", t("Erro ao salvar a propriedade."), 500, { requestId });
  }

  const propriedade = data as unknown as PropriedadeDaTarefa;

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task_property.updated",
    resourceType: "crm_task_properties",
    resourceId: propriedade.id,
    requestId,
    metadata: { campos: Object.keys(parsed.data) },
  });

  return ok({ property: propriedade }, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("manager", { requestId, resource: "crm_task_properties" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();

  // A definição primeiro, os valores depois: se a limpeza falhar sobram chaves órfãs
  // (inofensivas); no sentido contrário, o DELETE poderia falhar com os valores já idos.
  const { data, error } = await supabase
    .from("crm_task_properties")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id");

  if (error) {
    return fail("internal_error", t("Erro ao apagar a propriedade."), 500, { requestId });
  }
  if (!data || data.length === 0) {
    return fail("not_found", t("Propriedade não encontrada."), 404, { requestId });
  }

  await supabase.rpc("fn_tarefas_limpar_propriedade", { p_org: authz.org.orgId, p_prop: id });

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task_property.deleted",
    resourceType: "crm_task_properties",
    resourceId: id,
    requestId,
  });

  return ok({ deleted: true }, { requestId });
}
