import { requireSupportWrite } from "@/lib/impersonate/support";
/** DELETE /api/v1/marketing/pages/[key]/snapshots/[id] — apaga um retrato do histórico (manager+). */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string; id: string }> },
): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", t("Retrato não encontrado."), 404, { requestId });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_page_snapshots")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id")
    .maybeSingle();
  if (error) return fail("internal_error", t("Erro ao apagar o retrato."), 500, { requestId });
  if (!data) return fail("not_found", t("Retrato não encontrado."), 404, { requestId });

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "marketing_page.snapshot_deleted",
    resourceType: "marketing_page_snapshots",
    resourceId: id,
    requestId,
  });

  return ok({ deleted: true }, { requestId });
}
