import { logger } from "@/lib/logger";
import type { FalhaDeLeitura } from "../types";
import { buscarPaginado, montarUrl, type LinhaDeInsightCrua } from "./insights";
import { numeroOuNulo, valorDaAcao } from "./tabela-de-campanhas";

/**
 * Os insights DIA A DIA por ANÚNCIO — a base fina de tudo (campanha, conjunto, criativo, LP).
 * Mesma API de insights, no nível `ad` com `time_increment=1`.
 *
 * ⚠️ SÓ impressões, alcance, cliques no link, visitas à LP e gasto. Leads e resultados NUNCA vêm
 * do Meta (decisão do Arthur): os leads vêm do CRM.
 */

export interface DiaDoAnuncio {
  ad_id: string;
  ad_name: string;
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  day: string;
  spend: number;
  impressions: number;
  reach: number;
  link_clicks: number;
  lp_views: number;
  currency: string;
}

interface LinhaPorAnuncio extends LinhaDeInsightCrua {
  date_start?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  account_currency?: string;
}

const CAMPOS = [
  "ad_id",
  "ad_name",
  "adset_id",
  "adset_name",
  "campaign_id",
  "campaign_name",
  "spend",
  "impressions",
  "reach",
  "inline_link_clicks",
  "actions",
  "account_currency",
].join(",");

/** A linha crua do Meta vira uma linha da base; sem anúncio ou dia válido, é descartada. */
export function linhaDoAnuncio(l: LinhaPorAnuncio): DiaDoAnuncio | null {
  const day = l.date_start;
  if (!l.ad_id || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return {
    ad_id: l.ad_id,
    ad_name: l.ad_name ?? "",
    adset_id: l.adset_id ?? "",
    adset_name: l.adset_name ?? "",
    campaign_id: l.campaign_id ?? "",
    campaign_name: l.campaign_name ?? "",
    day,
    spend: Math.round((numeroOuNulo(l.spend) ?? 0) * 100) / 100,
    impressions: Math.round(numeroOuNulo(l.impressions) ?? 0),
    reach: Math.round(numeroOuNulo(l.reach) ?? 0),
    link_clicks: Math.round(numeroOuNulo(l.inline_link_clicks) ?? 0),
    lp_views: Math.round(valorDaAcao(l.actions) ?? 0),
    currency: l.account_currency ?? "",
  };
}

export type LeituraPorAnuncio =
  | { ok: true; linhas: DiaDoAnuncio[]; truncada: boolean }
  | { ok: false; falha: FalhaDeLeitura; detalhe: string };

/** Teto da leitura (20 páginas de 500): acima disso a janela é cortada em pedaços menores. */
const LINHAS_POR_LEITURA = 10_000;

/** Os insights por anúncio e por dia das campanhas pedidas (ids da plataforma). */
export async function lerInsightsPorAnuncio(
  token: string,
  contaId: string,
  campanhaIds: readonly string[],
  de: string,
  ate: string,
): Promise<LeituraPorAnuncio> {
  if (campanhaIds.length === 0) return { ok: true, linhas: [], truncada: false };
  const leitura = await buscarPaginado<LinhaPorAnuncio>(
    montarUrl(`${encodeURIComponent(contaId)}/insights`, {
      level: "ad",
      time_increment: "1",
      time_range: JSON.stringify({ since: de, until: ate }),
      filtering: JSON.stringify([
        { field: "campaign.id", operator: "IN", value: [...campanhaIds] },
      ]),
      fields: CAMPOS,
      limit: "500",
    }),
    token,
    "insights-por-anuncio",
  );
  if (!leitura.ok) {
    logger.warn("[ads.meta.insights-por-anuncio] leitura falhou", { falha: leitura.falha });
    return { ok: false, falha: leitura.falha, detalhe: leitura.detalhe };
  }
  const linhas = leitura.dados.flatMap((l) => {
    const d = linhaDoAnuncio(l);
    return d ? [d] : [];
  });
  return { ok: true, linhas, truncada: leitura.dados.length >= LINHAS_POR_LEITURA };
}
