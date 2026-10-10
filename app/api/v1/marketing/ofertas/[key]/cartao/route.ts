/**
 * GET /api/v1/marketing/ofertas/[key]/cartao — pré-visualização do cartão-resumo da oferta,
 * gerado do RASCUNHO (o que a agência está editando). Só a agência (manager+).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerBlocos } from "@/lib/marketing/blocos";
import { cartaoDaOferta } from "@/lib/marketing/cartao-da-oferta";
import { marcaDaOrg } from "@/lib/marketing/marca-da-org";
import { ofertaDosBlocos } from "@/lib/marketing/oferta";
import { lerChaveDePagina } from "@/lib/marketing/modulos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const chave = (await params).key;
  if (lerChaveDePagina(chave)?.tipo !== "oferta") {
    return fail("not_found", t("Página não encontrada."), 404, { requestId });
  }

  const supabase = await createClient();
  const { data: pagina } = await supabase
    .from("marketing_pages")
    .select("id, title, published_blocks")
    .eq("organization_id", authz.org.orgId)
    .eq("module_key", chave)
    .maybeSingle();
  const linha = pagina as { id: string; title: string; published_blocks: unknown } | null;
  if (!linha) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  const { data: rascunho } = await supabase
    .from("marketing_page_drafts")
    .select("blocks")
    .eq("page_id", linha.id)
    .maybeSingle();
  const blocos = lerBlocos(
    (rascunho as { blocks: unknown } | null)?.blocks ?? linha.published_blocks,
  );
  const oferta = ofertaDosBlocos(blocos);
  if (!oferta) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  const marca = await marcaDaOrg(authz.org.orgId);
  return cartaoDaOferta(linha.title || t("Oferta"), oferta, marca);
}
