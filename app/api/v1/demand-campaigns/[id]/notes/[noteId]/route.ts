/** DELETE /api/v1/demand-campaigns/[id]/notes/[noteId] — apaga uma nota do diário (manager+). */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id, noteId } = await ctx.params;
  const uuid = z.string().uuid();
  if (!uuid.safeParse(id).success || !uuid.safeParse(noteId).success) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  const { data, error } = await a.supabase
    .from("demand_campaign_notes")
    .delete()
    .eq("id", noteId)
    .eq("campaign_id", id)
    .eq("organization_id", a.orgId)
    .select("id")
    .maybeSingle();
  if (error) {
    return fail("internal_error", a.t("Erro ao apagar a nota."), 500, { requestId: a.requestId });
  }
  if (!data) return campanhaNaoEncontrada(a.t, a.requestId);
  return ok({ deleted: true }, { requestId: a.requestId });
}
