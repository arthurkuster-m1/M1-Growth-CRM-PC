/** PATCH/DELETE /api/v1/demand-creative-templates/[templateId] — edita ou apaga um modelo (manager+). */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import {
  COLUNAS_DO_MODELO,
  edicaoDeModeloSchema,
  modeloDaLinha,
} from "@/lib/marketing/modelos-de-criativo";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ templateId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const id = z
    .string()
    .uuid()
    .safeParse((await ctx.params).templateId);
  if (!id.success)
    return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
  const corpo = edicaoDeModeloSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { data, error } = await a.supabase
    .from("demand_creative_templates")
    .update(corpo.data)
    .eq("id", id.data)
    .eq("organization_id", a.orgId)
    .select(COLUNAS_DO_MODELO)
    .maybeSingle();
  if (error)
    return fail("internal_error", a.t("Erro ao salvar o modelo."), 500, { requestId: a.requestId });
  if (!data)
    return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
  return ok(
    { modelo: modeloDaLinha(data as unknown as Record<string, unknown>) },
    { requestId: a.requestId },
  );
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const id = z
    .string()
    .uuid()
    .safeParse((await ctx.params).templateId);
  if (!id.success)
    return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
  const { data, error } = await a.supabase
    .from("demand_creative_templates")
    .delete()
    .eq("id", id.data)
    .eq("organization_id", a.orgId)
    .select("id")
    .maybeSingle();
  if (error)
    return fail("internal_error", a.t("Erro ao apagar o modelo."), 500, { requestId: a.requestId });
  if (!data)
    return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
  return ok({ apagado: true }, { requestId: a.requestId });
}
