/**
 * GET /api/v1/marketing/pages/todas — todas as páginas da empresa (módulos e subpáginas) com o
 * estado de publicação, para a publicação em massa. Só a agência (manager+).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerBlocos } from "@/lib/marketing/blocos";
import { lerChaveDePagina } from "@/lib/marketing/modulos";
import type { EstadoDePublicacao, PaginaParaPublicar } from "@/lib/marketing/paginas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { data: paginas, error } = await supabase
    .from("marketing_pages")
    .select("id, module_key, title, published_blocks, sort_order, created_at")
    .eq("organization_id", authz.org.orgId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) return fail("internal_error", t("Erro ao carregar as páginas."), 500, { requestId });

  const linhas = (paginas ?? []) as Array<{
    id: string;
    module_key: string;
    title: string;
    published_blocks: unknown;
  }>;
  const { data: rascunhos } = await supabase
    .from("marketing_page_drafts")
    .select("page_id, blocks")
    .in(
      "page_id",
      linhas.map((l) => l.id),
    );
  const porPagina = new Map(
    ((rascunhos ?? []) as Array<{ page_id: string; blocks: unknown }>).map((r) => [
      r.page_id,
      lerBlocos(r.blocks),
    ]),
  );

  const resposta: PaginaParaPublicar[] = [];
  for (const l of linhas) {
    const chave = lerChaveDePagina(l.module_key);
    if (!chave) continue;
    const rascunho = porPagina.get(l.id) ?? [];
    const publicado = l.published_blocks === null ? null : lerBlocos(l.published_blocks);
    let estado: EstadoDePublicacao;
    if (publicado !== null) {
      estado = JSON.stringify(publicado) === JSON.stringify(rascunho) ? "publicada" : "alteracoes";
    } else {
      estado = rascunho.length > 0 ? "rascunho" : "vazia";
    }
    resposta.push({
      key: l.module_key,
      modulo: chave.modulo,
      tipo: chave.tipo,
      title: l.title,
      estado,
    });
  }
  return ok({ paginas: resposta }, { requestId });
}
