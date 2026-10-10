import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PUT /api/v1/marketing/pages/[key]/draft — grava o RASCUNHO da página (a agência editando).
 *
 * Chamada a cada pausa de digitação, então NÃO audita (encheria o log): publicar e despublicar,
 * que são o que o cliente passa a ver, auditam. Cria a página na primeira gravação.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { chaveDePaginaSchema, edicaoDeRascunhoSchema } from "@/lib/marketing/paginas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ key: string }>;
}

export async function PUT(req: NextRequest, ctx: Contexto): Promise<Response> {
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

  const parsed = edicaoDeRascunhoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const supabase = await createClient();
  const { data: pagina, error } = await supabase
    .from("marketing_pages")
    .upsert(
      {
        organization_id: authz.org.orgId,
        module_key: chave.data,
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      },
      { onConflict: "organization_id,module_key" },
    )
    .select("id")
    .single();
  if (error || !pagina) {
    return fail("internal_error", t("Erro ao salvar a página."), 500, { requestId });
  }

  const { data: rascunho, error: erroDoRascunho } = await supabase
    .from("marketing_page_drafts")
    .upsert(
      {
        page_id: (pagina as { id: string }).id,
        organization_id: authz.org.orgId,
        blocks: parsed.data.blocks,
        updated_by: authz.user.id,
      },
      { onConflict: "page_id" },
    )
    .select("updated_at")
    .single();
  if (erroDoRascunho || !rascunho) {
    return fail("internal_error", t("Erro ao salvar a página."), 500, { requestId });
  }

  return ok({ updated_at: (rascunho as { updated_at: string }).updated_at }, { requestId });
}
