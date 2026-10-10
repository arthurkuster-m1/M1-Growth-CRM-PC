import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/marketing/pages/[key]/publish — publica o rascunho: o que está no rascunho
 * passa a ser o que o cliente vê (e o que o link sem login mostra).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerBlocos } from "@/lib/marketing/blocos";
import { chaveDePaginaSchema } from "@/lib/marketing/paginas";
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

  const chave = chaveDePaginaSchema.safeParse((await ctx.params).key);
  if (!chave.success) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  const supabase = await createClient();
  const { data: pagina } = await supabase
    .from("marketing_pages")
    .select("id")
    .eq("organization_id", authz.org.orgId)
    .eq("module_key", chave.data)
    .maybeSingle();
  const id = (pagina as { id: string } | null)?.id;
  const { data: rascunho } = id
    ? await supabase.from("marketing_page_drafts").select("blocks").eq("page_id", id).maybeSingle()
    : { data: null };
  if (!id || !rascunho) {
    return fail("validation_failed", t("Não há rascunho para publicar."), 422, { requestId });
  }

  // O que vai para o cliente passa pela mesma validação de sempre: bloco inválido nunca é publicado.
  const blocos = lerBlocos((rascunho as { blocks: unknown }).blocks);
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("marketing_pages")
    .update({ published_blocks: blocos, published_at: agora, published_by: authz.user.id })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId);
  if (error) return fail("internal_error", t("Erro ao publicar a página."), 500, { requestId });

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "marketing_page.published",
    resourceType: "marketing_pages",
    resourceId: id,
    requestId,
    metadata: { module_key: chave.data, blocos: blocos.length },
  });

  return ok({ published_at: agora, blocos: blocos.length }, { requestId });
}
