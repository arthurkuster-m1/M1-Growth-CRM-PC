import "server-only";

import { createHash } from "node:crypto";

import { BUCKET_DAS_FOTOS, MAXIMO_DE_FOTOS } from "@/lib/catalogo/fotos";
import { lerBlocos } from "@/lib/marketing/blocos";
import { cartaoDaOferta } from "@/lib/marketing/cartao-da-oferta";
import { BUCKET_DE_IMAGENS, caminhoDaImagem } from "@/lib/marketing/imagens";
import { marcaDaOrg } from "@/lib/marketing/marca-da-org";
import { linhaDoCatalogo, ofertaDosBlocos } from "@/lib/marketing/oferta";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/** Um uuid estável a partir de um texto (o mesmo conteúdo gera o mesmo nome de arquivo). */
function uuidDe(texto: string): string {
  const h = createHash("sha256").update(texto).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

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
    const ofertas = new Map<
      string,
      { titulo: string; oferta: NonNullable<ReturnType<typeof ofertaDosBlocos>> }
    >();
    for (const p of (data ?? []) as Array<{
      module_key: string;
      title: string;
      published_blocks: unknown;
    }>) {
      if (p.published_blocks === null) continue;
      const oferta = ofertaDosBlocos(lerBlocos(p.published_blocks));
      if (!oferta) continue;
      const linha = linhaDoCatalogo(p.module_key, p.title, oferta);
      linhas.push(linha);
      ofertas.set(linha.codigo, { titulo: p.title, oferta });
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

    // As imagens: as da oferta e, se pedido, o cartão-resumo. Sem imagem, o produto vai só com
    // texto e preço. Os arquivos vivem em `catalog-photos` (de onde o envio da IA lê) e têm nome
    // derivado do conteúdo, então publicar de novo não duplica nada.
    const marca = ofertas.size > 0 ? await marcaDaOrg(orgId) : null;
    for (const [codigo, { titulo, oferta }] of ofertas) {
      const { data: produto } = await admin
        .from("catalog_products")
        .select("id, fotos")
        .eq("organization_id", orgId)
        .eq("codigo", codigo)
        .maybeSingle();
      const p = produto as { id: string; fotos: string[] | null } | null;
      if (!p) continue;
      const atuais = p.fotos ?? [];
      const desejadas: string[] = [];

      for (const arquivo of oferta.imagens ?? []) {
        if (desejadas.length >= MAXIMO_DE_FOTOS) break;
        const ext = arquivo.endsWith(".png") ? "png" : "jpg";
        const destino = `${orgId}/${p.id}/${uuidDe(`img:${arquivo}`)}.${ext}`;
        desejadas.push(destino);
        if (atuais.includes(destino)) continue;
        const { error: e } = await admin.storage
          .from(BUCKET_DE_IMAGENS)
          .copy(caminhoDaImagem(orgId, arquivo), destino, { destinationBucket: BUCKET_DAS_FOTOS });
        if (e && !/already exists/i.test(e.message)) {
          desejadas.pop();
          logger.warn("[ofertas→catálogo] imagem não copiada", {
            detalhe: e.message.slice(0, 120),
          });
        }
      }

      if (oferta.cartaoResumo && desejadas.length < MAXIMO_DE_FOTOS && marca) {
        const destino = `${orgId}/${p.id}/${uuidDe(`cartao:${JSON.stringify([titulo, oferta])}`)}.png`;
        desejadas.push(destino);
        if (!atuais.includes(destino)) {
          try {
            const png = new Uint8Array(await cartaoDaOferta(titulo, oferta, marca).arrayBuffer());
            const { error: e } = await admin.storage
              .from(BUCKET_DAS_FOTOS)
              .upload(destino, png, { contentType: "image/png", upsert: true });
            if (e) {
              desejadas.pop();
              logger.warn("[ofertas→catálogo] cartão não enviado", {
                detalhe: e.message.slice(0, 120),
              });
            }
          } catch (erro) {
            desejadas.pop();
            logger.warn("[ofertas→catálogo] cartão não gerado", {
              detalhe: erro instanceof Error ? erro.message.slice(0, 120) : String(erro),
            });
          }
        }
      }

      const mudou = desejadas.length !== atuais.length || desejadas.some((d, i) => d !== atuais[i]);
      if (mudou) {
        await admin.from("catalog_products").update({ fotos: desejadas }).eq("id", p.id);
        const removidas = atuais.filter((a) => !desejadas.includes(a));
        if (removidas.length > 0) await admin.storage.from(BUCKET_DAS_FOTOS).remove(removidas);
      }
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
