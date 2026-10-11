/** PATCH/DELETE /api/v1/demand-campaigns/[id]/landing-pages/[lpId] — edita ou apaga (manager+). */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import { COLUNAS_DA_LP, edicaoDeLpSchema, lpDaLinha } from "@/lib/marketing/landing-pages";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; lpId: string }> };

const uuid = z.string().uuid();

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id, lpId } = await ctx.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(lpId).success) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  const corpo = edicaoDeLpSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { data, error } = await a.supabase
    .from("demand_campaign_landing_pages")
    .update(corpo.data)
    .eq("id", lpId)
    .eq("campaign_id", id)
    .eq("organization_id", a.orgId)
    .select(COLUNAS_DA_LP)
    .maybeSingle();
  if (error) {
    return fail("internal_error", a.t("Erro ao salvar a landing page."), 500, {
      requestId: a.requestId,
    });
  }
  if (!data) {
    return fail("not_found", a.t("Landing page não encontrada."), 404, {
      requestId: a.requestId,
    });
  }
  return ok(
    { landing_page: lpDaLinha(data as Record<string, unknown>) },
    { requestId: a.requestId },
  );
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id, lpId } = await ctx.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(lpId).success) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  const { error } = await a.supabase
    .from("demand_campaign_landing_pages")
    .delete()
    .eq("id", lpId)
    .eq("campaign_id", id)
    .eq("organization_id", a.orgId);
  if (error) {
    return fail("internal_error", a.t("Erro ao apagar a landing page."), 500, {
      requestId: a.requestId,
    });
  }
  return ok({ apagado: true }, { requestId: a.requestId });
}
