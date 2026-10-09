import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * DELETE /api/v1/marketing/share-links/[id] — revoga o link: a partir de agora ele responde
 * 404, como se nunca tivesse existido. (A linha fica, marcada como revogada, para o rastro.)
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_share_links",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .is("revoked_at", null)
    .select("id");
  if (error) return fail("internal_error", t("Erro ao revogar o link."), 500, { requestId });
  if (!data || data.length === 0) {
    return fail("not_found", t("Link não encontrado."), 404, { requestId });
  }

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "marketing_share_link.revoked",
    resourceType: "marketing_share_links",
    resourceId: id,
    requestId,
  });

  return ok({ revoked: true }, { requestId });
}
