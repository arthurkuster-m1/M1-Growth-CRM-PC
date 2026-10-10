import "server-only";

import { lerBlocos } from "@/lib/marketing/blocos";
import { linhaDoCatalogo, ofertaDosBlocos } from "@/lib/marketing/oferta";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/** A origem das linhas do catálogo que nascem das ofertas (vocabulário aberto da coluna). */
export const ORIGEM_OFERTA = "oferta";

/**
 * Mantém o catálogo que a IA consulta IGUAL às ofertas PUBLICADAS da empresa. A oferta é a
 * única fonte de produto e preço: publicar cria ou atualiza a linha, tirar do ar ou apagar a
 * desativa. Nunca lança: a publicação já aconteceu, e o catálogo se acerta na próxima.
 */
export async function sincronizarOfertas(orgId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("marketing_pages")
      .select("module_key, title, published_blocks")
      .eq("organization_id", orgId)
      .like("module_key", "produtos-e-ofertas--%")
      .limit(300);

    const linhas = [];
    for (const p of (data ?? []) as Array<{
      module_key: string;
      title: string;
      published_blocks: unknown;
    }>) {
      if (p.published_blocks === null) continue;
      const oferta = ofertaDosBlocos(lerBlocos(p.published_blocks));
      if (oferta) linhas.push(linhaDoCatalogo(p.module_key, p.title, oferta));
    }

    for (const l of linhas) {
      const { error } = await admin.from("catalog_products").upsert(
        {
          organization_id: orgId,
          codigo: l.codigo,
          nome: l.nome,
          descricao: l.descricao,
          categoria: l.categoria,
          preco_cents: l.preco_cents,
          moeda: "BRL",
          controla_estoque: false,
          quantidade: 0,
          ativo: true,
          origem: ORIGEM_OFERTA,
        },
        { onConflict: "organization_id,codigo" },
      );
      if (error) logger.warn("[ofertas→catálogo] upsert falhou", { detalhe: error.message });
    }

    // O que saiu do ar (ou foi apagado) deixa de existir para a IA.
    const codigos = linhas.map((l) => l.codigo);
    let consulta = admin
      .from("catalog_products")
      .update({ ativo: false })
      .eq("organization_id", orgId)
      .eq("origem", ORIGEM_OFERTA)
      .eq("ativo", true);
    if (codigos.length > 0) {
      consulta = consulta.not("codigo", "in", `(${codigos.map((c) => `"${c}"`).join(",")})`);
    }
    const { error } = await consulta;
    if (error) logger.warn("[ofertas→catálogo] desativação falhou", { detalhe: error.message });
  } catch (erro) {
    logger.warn("[ofertas→catálogo] sincronização falhou", {
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });
  }
}
