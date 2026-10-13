import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { lerConjuntos } from "@/lib/plataformas-de-anuncio/meta/anuncios";
import { lerInsightsPorAnuncio } from "@/lib/plataformas-de-anuncio/meta/insights-por-anuncio";

/**
 * A BASE DIÁRIA POR ANÚNCIO: lê do Meta (nível anúncio, dia a dia) e grava em
 * `ad_insights_daily`. É o que permite gasto, cliques e CPL por criativo, conjunto e landing page
 * em qualquer período. Escreve com o cliente admin e confere a organização em toda consulta.
 *
 * O Meta corrige os números por alguns dias depois do dia fechar; por isso as rodadas relêem a
 * janela recente (7 dias) várias vezes ao dia e os últimos 28 dias de madrugada.
 */

const MS_DO_DIA = 86_400_000;
const PEDACO_EM_DIAS = 7;
const LIMITE_DA_PRIMEIRA_CARGA_EM_DIAS = 90;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const somarDias = (dia: string, n: number) =>
  iso(new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * MS_DO_DIA));

/** Corta [de, ate] em pedaços de até 7 dias: cada leitura cabe no teto de linhas da API. */
export function pedacosDaJanela(de: string, ate: string): Array<{ de: string; ate: string }> {
  const out: Array<{ de: string; ate: string }> = [];
  for (let inicio = de; inicio <= ate; inicio = somarDias(inicio, PEDACO_EM_DIAS)) {
    const fim = somarDias(inicio, PEDACO_EM_DIAS - 1);
    out.push({ de: inicio, ate: fim > ate ? ate : fim });
  }
  return out;
}

export type ModoDaBase = "primeira_carga" | "recente" | "profundo";

/**
 * Que janela ler agora. Sem nenhum dado ainda: a primeira carga (do início da campanha, no
 * máximo 90 dias). Manual ou a cada 6 horas: os últimos 7 dias. De madrugada (3h em Brasília):
 * os últimos 28.
 */
export function janelaDaBase(
  c: { start_date: string | null; end_date: string | null },
  agora: Date,
  temDados: boolean,
  manual: boolean,
): { modo: ModoDaBase; de: string; ate: string } | null {
  const hoje = iso(agora);
  const fim = c.end_date && c.end_date < hoje ? c.end_date : hoje;
  const maisAntigo = somarDias(hoje, -LIMITE_DA_PRIMEIRA_CARGA_EM_DIAS);
  const inicioDaCampanha = c.start_date ?? somarDias(hoje, -30);
  if (!temDados) {
    const de = inicioDaCampanha < maisAntigo ? maisAntigo : inicioDaCampanha;
    return de > fim ? null : { modo: "primeira_carga", de, ate: fim };
  }
  const profundo = !manual && agora.getUTCHours() === 6;
  const dias = profundo ? 28 : 7;
  if (!manual && !profundo && agora.getUTCHours() % 6 !== 0) return null;
  const de = somarDias(hoje, -(dias - 1));
  const deFinal = de < inicioDaCampanha ? inicioDaCampanha : de;
  return deFinal > fim ? null : { modo: profundo ? "profundo" : "recente", de: deFinal, ate: fim };
}

export type ResultadoDaBase =
  | { ok: true; linhas: number; diferencaPct: number | null }
  | { ok: false; falha: string }
  | { ok: "pulou" };

interface Alvo {
  id: string;
  organization_id: string;
  start_date: string | null;
  end_date: string | null;
}

export async function sincronizarBaseDiaria(
  admin: SupabaseClient,
  c: Alvo,
  token: string,
  conta: string,
  campanhaIds: readonly string[],
  agora: Date,
  manual: boolean,
): Promise<ResultadoDaBase> {
  const { count } = await admin
    .from("ad_insights_daily")
    .select("ad_id", { count: "exact", head: true })
    .eq("organization_id", c.organization_id)
    .eq("platform", "meta_ads")
    .in("campaign_id", [...campanhaIds]);
  const janela = janelaDaBase(c, agora, (count ?? 0) > 0, manual);
  if (!janela) return { ok: "pulou" };

  let gravadas = 0;
  for (const p of pedacosDaJanela(janela.de, janela.ate)) {
    const leitura = await lerInsightsPorAnuncio(token, conta, campanhaIds, p.de, p.ate);
    if (!leitura.ok) return { ok: false, falha: leitura.falha };
    if (leitura.truncada) {
      logger.warn("[meta-por-anuncio] leitura no teto de linhas", { campanha: c.id, ...p });
    }
    if (leitura.linhas.length === 0) continue;
    const linhas = leitura.linhas.map((l) => ({
      organization_id: c.organization_id,
      platform: "meta_ads",
      account_id: conta,
      ad_id: l.ad_id,
      day: l.day,
      campaign_id: l.campaign_id,
      campaign_name: l.campaign_name,
      adset_id: l.adset_id,
      adset_name: l.adset_name,
      ad_name: l.ad_name,
      spend: l.spend,
      impressions: l.impressions,
      reach: l.reach,
      link_clicks: l.link_clicks,
      lp_views: l.lp_views,
      currency: l.currency,
      synced_at: agora.toISOString(),
    }));
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await admin
        .from("ad_insights_daily")
        .upsert(linhas.slice(i, i + 500), { onConflict: "organization_id,platform,ad_id,day" });
      if (error) {
        logger.error("[meta-por-anuncio] gravação falhou", {
          campanha: c.id,
          error: error.message,
        });
        return { ok: false, falha: "erro_ao_gravar" };
      }
      gravadas += Math.min(500, linhas.length - i);
    }
  }

  // Conferência: a soma do gasto por anúncio contra o gasto por campanha, nos mesmos dias.
  const [{ data: dosAnuncios }, { data: daCampanha }] = await Promise.all([
    admin
      .from("ad_insights_daily")
      .select("spend")
      .eq("organization_id", c.organization_id)
      .eq("platform", "meta_ads")
      .in("campaign_id", [...campanhaIds])
      .gte("day", janela.de)
      .lte("day", janela.ate)
      .limit(50_000),
    admin
      .from("demand_campaign_days")
      .select("spend")
      .eq("organization_id", c.organization_id)
      .eq("campaign_id", c.id)
      .gte("day", janela.de)
      .lte("day", janela.ate)
      .limit(1000),
  ]);
  const somaAnuncios = (dosAnuncios ?? []).reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const somaCampanha = (daCampanha ?? []).reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const diferencaPct =
    somaCampanha > 0
      ? Math.round(((somaAnuncios - somaCampanha) / somaCampanha) * 1000) / 10
      : null;
  await admin
    .from("demand_campaigns")
    .update({ meta_ads_synced_at: agora.toISOString(), meta_ads_diff_pct: diferencaPct })
    .eq("id", c.id)
    .eq("organization_id", c.organization_id);
  return { ok: true, linhas: gravadas, diferencaPct };
}

/** Grava os conjuntos de anúncios (nome e status) das campanhas atreladas. */
export async function sincronizarConjuntos(
  admin: SupabaseClient,
  c: { id: string; organization_id: string },
  token: string,
  campanhaIds: readonly string[],
  agora: Date,
): Promise<void> {
  const leitura = await lerConjuntos(token, campanhaIds);
  if (!leitura.ok || leitura.dados.length === 0) return;
  const { error } = await admin.from("ad_adsets").upsert(
    leitura.dados.map((x) => ({
      organization_id: c.organization_id,
      platform: "meta_ads",
      adset_id: x.id,
      campaign_id: x.campaignId,
      name: x.name,
      status: x.status,
      effective_status: x.effectiveStatus,
      synced_at: agora.toISOString(),
    })),
    { onConflict: "organization_id,platform,adset_id" },
  );
  if (error)
    logger.error("[meta-por-anuncio] conjuntos: gravação falhou", { error: error.message });
}
