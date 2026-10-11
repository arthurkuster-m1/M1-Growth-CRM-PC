import { logger } from "@/lib/logger";
import type { FalhaDeLeitura } from "../types";
import { buscarPaginado, montarUrl, type LinhaDeInsightCrua } from "./insights";
import { numeroOuNulo, valorDaAcao } from "./tabela-de-campanhas";

/**
 * Os insights DIA A DIA de um conjunto de campanhas — o que alimenta a "aba diária" da campanha
 * de demanda (C3). Mesma API de insights da tela do Meta Ads, com `time_increment=1`.
 *
 * ⚠️ SÓ impressões, alcance, cliques, visitas à LP e gasto. Leads e resultados NUNCA vêm do Meta
 * (decisão do Arthur: variação falsa) — os leads da campanha vêm do CRM.
 *
 * Leitura pura de números: o cruzamento por campanha do Software e a gravação ficam em
 * `lib/marketing/campanhas-meta-servidor.ts`.
 */

export interface DiaDoMeta {
  day: string;
  impressions: number;
  reach: number;
  link_clicks: number;
  lp_views: number;
  spend: number;
}

interface LinhaPorDia extends LinhaDeInsightCrua {
  date_start?: string;
}

const CAMPOS = [
  "campaign_id",
  "spend",
  "impressions",
  "reach",
  "inline_link_clicks",
  "actions",
].join(",");

/**
 * Soma as linhas (uma por campanha e por dia) em UMA linha por dia. A ausência vira 0 aqui — é
 * a planilha do dia a dia, onde "sem dado" e "zero" se confundem de propósito; a tela do Meta
 * Ads continua distinguindo.
 */
export function somarPorDia(linhas: readonly LinhaPorDia[]): DiaDoMeta[] {
  const porDia = new Map<string, DiaDoMeta>();
  for (const l of linhas) {
    const day = l.date_start;
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const atual =
      porDia.get(day) ??
      ({
        day,
        impressions: 0,
        reach: 0,
        link_clicks: 0,
        lp_views: 0,
        spend: 0,
      } as DiaDoMeta);
    atual.spend += numeroOuNulo(l.spend) ?? 0;
    atual.impressions += numeroOuNulo(l.impressions) ?? 0;
    atual.reach += numeroOuNulo(l.reach) ?? 0;
    atual.link_clicks += numeroOuNulo(l.inline_link_clicks) ?? 0;
    atual.lp_views += valorDaAcao(l.actions) ?? 0;
    porDia.set(day, atual);
  }
  return [...porDia.values()]
    .map((d) => ({ ...d, spend: Math.round(d.spend * 100) / 100 }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export type LeituraPorDia =
  { ok: true; dias: DiaDoMeta[] } | { ok: false; falha: FalhaDeLeitura; detalhe: string };

/** Os insights por dia das campanhas pedidas (ids da plataforma), de `de` a `ate` (AAAA-MM-DD). */
export async function lerInsightsPorDia(
  token: string,
  contaId: string,
  campanhaIds: readonly string[],
  de: string,
  ate: string,
): Promise<LeituraPorDia> {
  if (campanhaIds.length === 0) return { ok: true, dias: [] };
  const leitura = await buscarPaginado<LinhaPorDia>(
    montarUrl(`${encodeURIComponent(contaId)}/insights`, {
      level: "campaign",
      time_increment: "1",
      time_range: JSON.stringify({ since: de, until: ate }),
      filtering: JSON.stringify([
        { field: "campaign.id", operator: "IN", value: [...campanhaIds] },
      ]),
      fields: CAMPOS,
      limit: "500",
    }),
    token,
    "insights-por-dia",
  );
  if (!leitura.ok) {
    logger.warn("[ads.meta.insights-por-dia] leitura falhou", { falha: leitura.falha });
    return { ok: false, falha: leitura.falha, detalhe: leitura.detalhe };
  }
  return { ok: true, dias: somarPorDia(leitura.dados) };
}
