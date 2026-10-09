import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/marketing/pages/[key]/unpublish — tira a página do ar: o cliente volta a ver
 * "em breve". O rascunho continua intacto.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { chaveDeModuloSchema } from "@/lib/marketing/paginas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ key: string }>;
}

export async function POST(_req: NextRequest, ctx: Contexto): Promise<Response> {
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

  const chave = chaveDeModuloSchema.safeParse((await ctx.params).key);
  if (!chave.success) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_pages")
    .update({ published_blocks: null, published_at: null, published_by: null })
    .eq("organization_id", authz.org.orgId)
    .eq("module_key", chave.data)
    .select("id");
  if (error) return fail("internal_error", t("Erro ao despublicar a página."), 500, { requestId });
  if (!data || data.length === 0) {
    return fail("not_found", t("Página não encontrada."), 404, { requestId });
  }

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "marketing_page.unpublished",
    resourceType: "marketing_pages",
    resourceId: (data[0] as { id: string }).id,
    requestId,
    metadata: { module_key: chave.data },
  });

  return ok({ unpublished: true }, { requestId });
}
