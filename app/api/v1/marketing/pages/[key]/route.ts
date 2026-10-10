/**
 * GET /api/v1/marketing/pages/[key] — uma página de marketing (um módulo da estratégia).
 *
 * Devolve o PUBLICADO a qualquer membro da empresa e, a quem é da agência (manager+), também o
 * rascunho. Quem protege o rascunho é a RLS (migration 0587): o cliente consulta com o próprio
 * JWT e simplesmente não tem linha de rascunho para ler — não é um `if` desta rota.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { lerChaveDePagina } from "@/lib/marketing/modulos";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerBlocos } from "@/lib/marketing/blocos";
import {
  COLUNAS_DA_PAGINA,
  chaveDePaginaSchema,
  type PaginaDeMarketing,
} from "@/lib/marketing/paginas";
import { sincronizarOfertas } from "@/lib/marketing/sincronizar-ofertas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ key: string }>;
}

export async function GET(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const chave = chaveDePaginaSchema.safeParse((await ctx.params).key);
  if (!chave.success) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  const supabase = await createClient();
  const { data: pagina, error } = await supabase
    .from("marketing_pages")
    .select(COLUNAS_DA_PAGINA)
    .eq("organization_id", authz.org.orgId)
    .eq("module_key", chave.data)
    .maybeSingle();
  if (error) return fail("internal_error", t("Erro ao carregar a página."), 500, { requestId });

  const linha = pagina as {
    id: string;
    module_key: string;
    title: string;
    published_blocks: unknown;
    published_at: string | null;
  } | null;

  let rascunho: PaginaDeMarketing["draft"] = null;
  if (linha) {
    const { data: d } = await supabase
      .from("marketing_page_drafts")
      .select("blocks, updated_at")
      .eq("page_id", linha.id)
      .maybeSingle();
    const r = d as { blocks: unknown; updated_at: string } | null;
    if (r) rascunho = { blocks: lerBlocos(r.blocks), updated_at: r.updated_at };
  }

  const podeEditar =
    roleAtLeast(authz.org.role, "manager") || (authz.user.is_platform_admin && !authz.user.support);

  const resposta: PaginaDeMarketing = {
    module_key: chave.data,
    title: linha?.title ?? "",
    published_blocks: linha?.published_blocks == null ? null : lerBlocos(linha.published_blocks),
    published_at: linha?.published_at ?? null,
    draft: rascunho,
    pode_editar: podeEditar,
  };
  return ok({ page: resposta }, { requestId });
}

/**
 * DELETE /api/v1/marketing/pages/[key] — apaga uma SUBPÁGINA (com o rascunho e o histórico).
 * A página de um módulo não se apaga: ela só pode ser despublicada.
 */
export async function DELETE(_req: NextRequest, ctx: Contexto): Promise<Response> {
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

  const chave = (await ctx.params).key;
  const lida = lerChaveDePagina(chave);
  if (!lida) return fail("not_found", t("Página não encontrada."), 404, { requestId });
  if (lida.tipo === null) {
    return fail("validation_failed", t("A página de um módulo não pode ser apagada."), 422, {
      requestId,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_pages")
    .delete()
    .eq("organization_id", authz.org.orgId)
    .eq("module_key", chave)
    .select("id")
    .maybeSingle();
  if (error) return fail("internal_error", t("Erro ao apagar a página."), 500, { requestId });
  if (!data) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "marketing_page.subpage_deleted",
    resourceType: "marketing_pages",
    resourceId: (data as { id: string }).id,
    requestId,
    metadata: { module_key: chave },
  });
  await sincronizarOfertas(authz.org.orgId);

  return ok({ deleted: true }, { requestId });
}
