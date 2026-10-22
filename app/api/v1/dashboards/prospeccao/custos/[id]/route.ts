/** DELETE /api/v1/dashboards/prospeccao/custos/[id] — apaga um custo lançado (a tela oferece Ctrl+Z). */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const id = z
    .string()
    .uuid()
    .safeParse((await ctx.params).id);
  if (!id.success)
    return fail("not_found", a.t("Custo não encontrado."), 404, { requestId: a.requestId });
  const { data, error } = await a.supabase
    .from("lead_source_costs")
    .delete()
    .eq("id", id.data)
    .eq("organization_id", a.orgId)
    .select("id, source, amount_cents")
    .maybeSingle();
  if (error)
    return fail("internal_error", a.t("Erro ao apagar o custo."), 500, { requestId: a.requestId });
  if (!data)
    return fail("not_found", a.t("Custo não encontrado."), 404, { requestId: a.requestId });
  await audit({
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: "lead_source_cost.deleted",
    resourceType: "lead_source_costs",
    resourceId: id.data,
    requestId: a.requestId,
    metadata: { source: (data as { source: string }).source },
  });
  return ok({ apagado: true }, { requestId: a.requestId });
}
