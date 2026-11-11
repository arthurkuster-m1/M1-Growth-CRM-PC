/**
 * POST /api/v1/marketing/ofertas/texto — os produtos escolhidos (`{ keys }`) como TEXTO de
 * planilha (tabulação, com cabeçalho), para copiar e colar em outra planilha ou na tabela de
 * colar produtos de outro cliente. Lê o rascunho (o que a agência vê); sem rascunho, o publicado.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerBlocos } from "@/lib/marketing/blocos";
import { lerChaveDePagina } from "@/lib/marketing/modulos";
import { ofertaDosBlocos } from "@/lib/marketing/oferta";
import { textoDeProdutos } from "@/lib/marketing/produtos-colagem";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const chaveDeOferta = z.string().refine((k) => {
  const lida = lerChaveDePagina(k);
  return lida?.modulo === "produtos-e-ofertas" && lida.tipo === "oferta";
}, "Produto inválido.");
const corpoSchema = z.object({ keys: z.array(chaveDeOferta).min(1).max(300) });

export async function POST(req: NextRequest): Promise<Response> {
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

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const supabase = await createClient();

  const { data: paginas, error } = await supabase
    .from("marketing_pages")
    .select("id, module_key, title, published_blocks")
    .eq("organization_id", authz.org.orgId)
    .in("module_key", corpo.data.keys);
  if (error) return fail("internal_error", t("Erro ao ler os produtos."), 500, { requestId });
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
  const doRascunho = new Map(
    ((rascunhos ?? []) as Array<{ page_id: string; blocks: unknown }>).map((r) => [
      r.page_id,
      r.blocks,
    ]),
  );

  // Na ordem em que a pessoa escolheu.
  const porChave = new Map(linhas.map((l) => [l.module_key, l]));
  const itens = corpo.data.keys.flatMap((k) => {
    const l = porChave.get(k);
    if (!l) return [];
    const oferta = ofertaDosBlocos(lerBlocos(doRascunho.get(l.id) ?? l.published_blocks));
    return oferta ? [{ titulo: l.title, oferta }] : [];
  });
  if (itens.length === 0) {
    return fail("not_found", t("Nenhum dos produtos foi encontrado."), 404, { requestId });
  }
  return ok({ texto: textoDeProdutos(itens), total: itens.length }, { requestId });
}
