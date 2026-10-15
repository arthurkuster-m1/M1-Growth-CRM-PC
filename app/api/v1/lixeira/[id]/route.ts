/**
 * DELETE /api/v1/lixeira/[id] — apaga DE VEZ um item da lixeira (gerente em diante). O que ficou
 * lá some sem volta.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", "Item não encontrado.", 404, { requestId });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_lixeira")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id, contact_id")
    .maybeSingle();
  if (error) return fail("internal_error", "Erro ao apagar.", 500, { requestId });
  if (!data) return fail("not_found", "Item não encontrado.", 404, { requestId });
  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "contact.deleted",
    resourceType: "contact",
    resourceId: (data as { contact_id: string }).contact_id,
    requestId,
    metadata: { lixeira: "apagado_de_vez" },
  });
  return ok({ apagado: true }, { requestId });
}
