import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { janelaDaSync } from "@/lib/marketing/campanhas-resumo";
import {
  lerAnuncios,
  lerMetricasPorAnuncio,
  type MetricasDoAnuncio,
} from "@/lib/plataformas-de-anuncio/meta/anuncios";

/**
 * Os criativos que vêm do Meta (C4): IMPORTAR os anúncios das campanhas atreladas (nome, título,
 * legenda, miniatura, formato) e ATUALIZAR as métricas de entrega de cada um. Escreve com o
 * cliente admin (o relógio não tem sessão) e confere a organização em toda consulta.
 */

interface Alvo {
  id: string;
  organization_id: string;
  start_date: string | null;
  end_date: string | null;
}

/** Grava as métricas nos criativos que têm `ad_id` igual ao do Meta. */
export async function gravarMetricasDosCriativos(
  admin: SupabaseClient,
  c: Alvo,
  metricas: readonly MetricasDoAnuncio[],
  agora: Date = new Date(),
): Promise<number> {
  let n = 0;
  for (const m of metricas) {
    const { data, error } = await admin
      .from("demand_campaign_creatives")
      .update({
        spend: m.spend,
        impressions: m.impressions,
        link_clicks: m.link_clicks,
        lp_views: m.lp_views,
        metrics_synced_at: agora.toISOString(),
      })
      .eq("organization_id", c.organization_id)
      .eq("campaign_id", c.id)
      .eq("ad_id", m.adId)
      .select("id");
    if (error) {
      logger.error("[criativos-meta] gravação das métricas falhou", { error: error.message });
      continue;
    }
    n += data?.length ?? 0;
  }
  return n;
}

/** Lê do Meta as métricas por anúncio e grava nos criativos já cadastrados. */
export async function atualizarMetricasDosCriativos(
  admin: SupabaseClient,
  c: Alvo,
  token: string,
  conta: string,
  campanhaIds: readonly string[],
  agora: Date = new Date(),
): Promise<void> {
  const { count } = await admin
    .from("demand_campaign_creatives")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", c.organization_id)
    .eq("campaign_id", c.id)
    .not("ad_id", "is", null);
  if (!count) return; // nada a atualizar: não gasta chamada
  const janela = janelaDaSync(c, agora);
  if (!janela) return;
  const leitura = await lerMetricasPorAnuncio(token, conta, campanhaIds, janela.de, janela.ate);
  if (!leitura.ok) return;
  await gravarMetricasDosCriativos(admin, c, leitura.dados, agora);
}

export type ResultadoDaImportacao =
  { ok: true; criados: number; existentes: number } | { ok: false; falha: string };

/** Cria um criativo para cada anúncio das campanhas atreladas que ainda não está na campanha. */
export async function importarCriativosDoMeta(
  admin: SupabaseClient,
  c: Alvo,
  token: string,
  campanhaIds: readonly string[],
  userId: string | null,
): Promise<ResultadoDaImportacao> {
  const leitura = await lerAnuncios(token, campanhaIds);
  if (!leitura.ok) return { ok: false, falha: leitura.falha };

  const { data: ja } = await admin
    .from("demand_campaign_creatives")
    .select("ad_id")
    .eq("organization_id", c.organization_id)
    .eq("campaign_id", c.id)
    .not("ad_id", "is", null);
  const existentes = new Set((ja ?? []).map((r) => r.ad_id as string));
  const novos = leitura.dados.filter((a) => !existentes.has(a.id));
  if (novos.length > 0) {
    const status = (s: string | null) =>
      s === "ACTIVE"
        ? "ativo"
        : s === "PAUSED" || s === "CAMPAIGN_PAUSED" || s === "ADSET_PAUSED"
          ? "pausado"
          : "encerrado";
    const { error } = await admin.from("demand_campaign_creatives").insert(
      novos.map((a) => ({
        organization_id: c.organization_id,
        campaign_id: c.id,
        name: a.name.slice(0, 160),
        status: status(a.status),
        format: a.formato,
        headline: a.titulo.slice(0, 300),
        caption: a.legenda.slice(0, 4000),
        media_url: "",
        thumbnail_url: (a.miniatura || a.imagem).slice(0, 2000),
        ad_id: a.id.slice(0, 40),
        ad_name: a.name.slice(0, 300),
        created_by: userId,
      })),
    );
    if (error) {
      logger.error("[criativos-meta] importação falhou", { error: error.message });
      return { ok: false, falha: "erro_ao_gravar" };
    }
  }
  return { ok: true, criados: novos.length, existentes: existentes.size };
}
