/** PATCH/DELETE /api/v1/demand-funnel-templates/[id] — renomeia ou apaga um modelo (manager+). */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import { renomearModeloSchema } from "@/lib/marketing/modelos-de-funil";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  const corpo = renomearModeloSchema.safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { data, error } = await a.supabase
    .from("demand_funnel_templates")
    .update({
      ...(corpo.data.name !== undefined ? { name: corpo.data.name } : {}),
      ...(corpo.data.stages !== undefined ? { stages: corpo.data.stages } : {}),
    })
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .select("id")
    .maybeSingle();
  if (error) {
    const duplicado = (error as { code?: string }).code === "23505";
    return fail(
      duplicado ? "validation_failed" : "internal_error",
      duplicado ? a.t("Já existe um modelo com esse nome.") : a.t("Erro ao salvar o modelo."),
      duplicado ? 422 : 500,
      { requestId: a.requestId },
    );
  }
  if (!data)
    return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
  return ok({ id }, { requestId: a.requestId });
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
  }
  const { error } = await a.supabase
    .from("demand_funnel_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", a.orgId);
  if (error) {
    return fail("internal_error", a.t("Erro ao apagar o modelo."), 500, {
      requestId: a.requestId,
    });
  }
  return ok({ apagado: true }, { requestId: a.requestId });
}
