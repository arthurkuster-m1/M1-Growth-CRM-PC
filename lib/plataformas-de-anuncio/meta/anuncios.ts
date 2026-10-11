import { logger } from "@/lib/logger";
import type { FalhaDeLeitura } from "../types";
import { buscarPaginado, montarUrl, type AcaoDaPlataforma } from "./insights";
import { numeroOuNulo, valorDaAcao } from "./tabela-de-campanhas";

/**
 * Os ANÚNCIOS (criativos) das campanhas do Meta e as métricas de ENTREGA de cada um (C4).
 * Mesma regra da C3: gasto, impressões, cliques e visitas à LP — leads e resultados nunca.
 */

export interface AnuncioDoMeta {
  id: string;
  name: string;
  status: string | null;
  campaignId: string | null;
  titulo: string;
  legenda: string;
  miniatura: string;
  imagem: string;
  formato: "imagem" | "video" | "carrossel" | "outro";
}

interface AnuncioCru {
  id?: string;
  name?: string;
  effective_status?: string;
  campaign_id?: string;
  creative?: {
    title?: string;
    body?: string;
    thumbnail_url?: string;
    image_url?: string;
    object_type?: string;
    video_id?: string;
  };
}

interface InsightDeAnuncio {
  ad_id?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  actions?: AcaoDaPlataforma[];
}

export interface MetricasDoAnuncio {
  adId: string;
  spend: number;
  impressions: number;
  link_clicks: number;
  lp_views: number;
}

function formatoDe(a: AnuncioCru): AnuncioDoMeta["formato"] {
  const tipo = (a.creative?.object_type ?? "").toUpperCase();
  if (a.creative?.video_id || tipo === "VIDEO") return "video";
  if (tipo === "SHARE" || tipo === "MULTI_SHARE") return "carrossel";
  if (tipo === "PHOTO" || a.creative?.image_url) return "imagem";
  return "outro";
}

export function anuncioDoMeta(a: AnuncioCru): AnuncioDoMeta | null {
  if (!a.id) return null;
  return {
    id: a.id,
    name: a.name ?? a.id,
    status: a.effective_status ?? null,
    campaignId: a.campaign_id ?? null,
    titulo: a.creative?.title ?? "",
    legenda: a.creative?.body ?? "",
    miniatura: a.creative?.thumbnail_url ?? "",
    imagem: a.creative?.image_url ?? "",
    formato: formatoDe(a),
  };
}

export function metricasDoAnuncio(l: InsightDeAnuncio): MetricasDoAnuncio | null {
  if (!l.ad_id) return null;
  return {
    adId: l.ad_id,
    spend: Math.round((numeroOuNulo(l.spend) ?? 0) * 100) / 100,
    impressions: numeroOuNulo(l.impressions) ?? 0,
    link_clicks: numeroOuNulo(l.inline_link_clicks) ?? 0,
    lp_views: valorDaAcao(l.actions) ?? 0,
  };
}

type Leitura<T> = { ok: true; dados: T } | { ok: false; falha: FalhaDeLeitura; detalhe: string };

/** Os anúncios das campanhas do Meta pedidas (uma chamada por campanha). */
export async function lerAnuncios(
  token: string,
  campanhaIds: readonly string[],
): Promise<Leitura<AnuncioDoMeta[]>> {
  const todos: AnuncioDoMeta[] = [];
  for (const id of campanhaIds) {
    const r = await buscarPaginado<AnuncioCru>(
      montarUrl(`${encodeURIComponent(id)}/ads`, {
        fields:
          "id,name,effective_status,campaign_id,creative{title,body,thumbnail_url,image_url,object_type,video_id}",
        limit: "100",
      }),
      token,
      "anuncios",
    );
    if (!r.ok) return { ok: false, falha: r.falha, detalhe: r.detalhe };
    for (const a of r.dados) {
      const m = anuncioDoMeta({ ...a, campaign_id: a.campaign_id ?? id });
      if (m) todos.push(m);
    }
  }
  return { ok: true, dados: todos };
}

/** As métricas de entrega por anúncio, no período, das campanhas pedidas. */
export async function lerMetricasPorAnuncio(
  token: string,
  contaId: string,
  campanhaIds: readonly string[],
  de: string,
  ate: string,
): Promise<Leitura<MetricasDoAnuncio[]>> {
  if (campanhaIds.length === 0) return { ok: true, dados: [] };
  const r = await buscarPaginado<InsightDeAnuncio>(
    montarUrl(`${encodeURIComponent(contaId)}/insights`, {
      level: "ad",
      time_range: JSON.stringify({ since: de, until: ate }),
      filtering: JSON.stringify([
        { field: "campaign.id", operator: "IN", value: [...campanhaIds] },
      ]),
      fields: "ad_id,spend,impressions,inline_link_clicks,actions",
      limit: "500",
    }),
    token,
    "insights-por-anuncio",
  );
  if (!r.ok) {
    logger.warn("[ads.meta.anuncios] métricas falharam", { falha: r.falha });
    return { ok: false, falha: r.falha, detalhe: r.detalhe };
  }
  return {
    ok: true,
    dados: r.dados.flatMap((l) => {
      const m = metricasDoAnuncio(l);
      return m ? [m] : [];
    }),
  };
}
