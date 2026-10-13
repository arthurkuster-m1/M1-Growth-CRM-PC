import { requireSupportWrite } from "@/lib/impersonate/support";
/** DELETE /api/v1/contacts/[id]/anotacoes/[noteId] — remove uma anotação do lead (atendente em diante). */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const p = await ctx.params;
  const ids = z.object({ id: z.string().uuid(), noteId: z.string().uuid() }).safeParse(p);
  if (!ids.success) return fail("not_found", t("Anotação não encontrada."), 404, { requestId });

  const { data, error } = await createAdminClient()
    .from("lead_notes")
    .delete()
    .eq("id", ids.data.noteId)
    .eq("contact_id", ids.data.id)
    .eq("organization_id", authz.org.orgId)
    .select("id");
  if (error) return fail("internal_error", t("Erro ao apagar a anotação."), 500, { requestId });
  if (!data || data.length === 0) {
    return fail("not_found", t("Anotação não encontrada."), 404, { requestId });
  }
  return ok({ removida: true }, { requestId });
}
