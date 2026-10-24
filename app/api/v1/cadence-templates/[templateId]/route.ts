/** DELETE /api/v1/cadence-templates/[templateId] — apaga um modelo da empresa (manager+). */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ templateId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { templateId } = await ctx.params;
  if (!z.string().uuid().safeParse(templateId).success) {
    return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
  }
  // Só apaga modelo (campaign_id nulo): a cadência de uma campanha não sai por aqui.
  const { error } = await a.supabase
    .from("demand_cadences")
    .delete()
    .eq("id", templateId)
    .eq("organization_id", a.orgId)
    .is("campaign_id", null);
  if (error) {
    return fail("internal_error", a.t("Erro ao apagar o modelo."), 500, { requestId: a.requestId });
  }
  return ok({ apagado: true }, { requestId: a.requestId });
}
