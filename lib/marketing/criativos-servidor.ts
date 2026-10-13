import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { janelaDaSync } from "@/lib/marketing/campanhas-resumo";
import { createHash, randomUUID } from "node:crypto";

import { extensaoDe, farejarTipo } from "@/lib/branding/logo-arquivo";
import { BUCKET_DE_IMAGENS, TAMANHO_MAXIMO_DA_IMAGEM, caminhoDaImagem } from "@/lib/marketing/imagens";
import {
  lerAnuncios,
  lerMetricasPorAnuncio,
  urlsDasImagens,
  type AnuncioDoMeta,
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

/** Quantas imagens se baixam por rodada (poupa tempo e a banda da cota do servidor). */
const MAX_DOWNLOADS_POR_RODADA = 40;

/** Baixa UMA imagem do Meta e guarda no bucket da organização; devolve o nome do arquivo. */
async function guardarImagem(
  admin: SupabaseClient,
  orgId: string,
  endereco: string,
  vistos: Set<string>,
): Promise<string | null> {
  try {
    if (!/^https:\/\//i.test(endereco)) return null;
    const resp = await fetch(endereco, { signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) return null;
    const declarado = Number(resp.headers.get("content-length") ?? 0);
    if (declarado > TAMANHO_MAXIMO_DA_IMAGEM) return null;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    if (bytes.length === 0 || bytes.length > TAMANHO_MAXIMO_DA_IMAGEM) return null;
    const tipo = farejarTipo(bytes);
    if (!tipo) return null;
    // A mesma imagem por dois endereços (a do anúncio e a da biblioteca) entra uma vez só.
    const impressao = createHash("sha256").update(bytes).digest("hex");
    if (vistos.has(impressao)) return null;
    vistos.add(impressao);
    const arquivo = `${randomUUID()}.${extensaoDe(tipo)}`;
    const { error } = await admin.storage
      .from(BUCKET_DE_IMAGENS)
      .upload(caminhoDaImagem(orgId, arquivo), bytes, { contentType: tipo, upsert: false });
    return error ? null : arquivo;
  } catch {
    return null;
  }
}

/**
 * As imagens do anúncio no bucket. `orcamento` é compartilhado entre os anúncios da rodada
 * (quando acaba, o resto fica para a próxima: nada se perde).
 */
async function imagensDoAnuncio(
  admin: SupabaseClient,
  orgId: string,
  a: AnuncioDoMeta,
  porHash: ReadonlyMap<string, string>,
  orcamento: { restante: number },
): Promise<string[]> {
  const enderecos = [
    ...a.imagens,
    ...a.hashesDeImagem.flatMap((h) => (porHash.get(h) ? [porHash.get(h)!] : [])),
  ];
  const nomes: string[] = [];
  const vistos = new Set<string>();
  for (const e of [...new Set(enderecos)].slice(0, 10)) {
    if (orcamento.restante <= 0) break;
    orcamento.restante -= 1;
    const nome = await guardarImagem(admin, orgId, e, vistos);
    if (nome) nomes.push(nome);
  }
  return nomes;
}

/**
 * Cria um criativo para cada anúncio das campanhas atreladas que ainda não está na campanha,
 * com TODAS as variações de título, legenda e descrição e as imagens. Os que já existem só
 * ganham o que lhes falta (nunca se sobrescreve o que a pessoa editou).
 */
export async function importarCriativosDoMeta(
  admin: SupabaseClient,
  c: Alvo,
  token: string,
  campanhaIds: readonly string[],
  userId: string | null,
  conta: string | null = null,
): Promise<ResultadoDaImportacao> {
  const leitura = await lerAnuncios(token, campanhaIds);
  if (!leitura.ok) return { ok: false, falha: leitura.falha };

  const { data: ja } = await admin
    .from("demand_campaign_creatives")
    .select("ad_id, link_url, headlines, bodies, descriptions, images")
    .eq("organization_id", c.organization_id)
    .eq("campaign_id", c.id)
    .not("ad_id", "is", null);
  const existentes = new Map((ja ?? []).map((r) => [r.ad_id as string, r]));
  const novos = leitura.dados.filter((a) => !existentes.has(a.id));

  // Imagens que o anúncio dinâmico guarda só pelo hash: resolve de uma vez pela conta.
  const hashes = leitura.dados.flatMap((a) => a.hashesDeImagem);
  const porHash = conta ? await urlsDasImagens(token, conta, hashes) : new Map<string, string>();
  const orcamento = { restante: MAX_DOWNLOADS_POR_RODADA };

  // Criativos já importados: completa o que está vazio (link, textos, imagens).
  for (const a of leitura.dados) {
    const atual = existentes.get(a.id);
    if (!atual) continue;
    const vazio = (v: unknown) => !Array.isArray(v) || v.length === 0;
    const patch: Record<string, unknown> = {};
    if (a.link && !(atual.link_url as string | null)) patch.link_url = a.link;
    if (vazio(atual.headlines) && a.titulos.length > 0) patch.headlines = a.titulos;
    if (vazio(atual.bodies) && a.legendas.length > 0) patch.bodies = a.legendas;
    if (vazio(atual.descriptions) && a.descricoes.length > 0) patch.descriptions = a.descricoes;
    // Já tem mais de um texto no Meta, mas só o primeiro aqui (importado antes): completa.
    const curto = (v: unknown, novo: string[]) =>
      Array.isArray(v) && v.length === 1 && novo.length > 1 && v[0] === novo[0];
    if (curto(atual.headlines, a.titulos)) patch.headlines = a.titulos;
    if (curto(atual.bodies, a.legendas)) patch.bodies = a.legendas;
    if (curto(atual.descriptions, a.descricoes)) patch.descriptions = a.descricoes;
    if (vazio(atual.images) && (a.imagens.length > 0 || a.hashesDeImagem.length > 0)) {
      const nomes = await imagensDoAnuncio(admin, c.organization_id, a, porHash, orcamento);
      if (nomes.length > 0) patch.images = nomes;
    }
    if (Object.keys(patch).length === 0) continue;
    await admin
      .from("demand_campaign_creatives")
      .update(patch)
      .eq("organization_id", c.organization_id)
      .eq("campaign_id", c.id)
      .eq("ad_id", a.id);
  }

  if (novos.length > 0) {
    const status = (s: string | null) =>
      s === "ACTIVE"
        ? "ativo"
        : s === "PAUSED" || s === "CAMPAIGN_PAUSED" || s === "ADSET_PAUSED"
          ? "pausado"
          : "encerrado";
    const linhas = [];
    for (const a of novos) {
      const images = await imagensDoAnuncio(admin, c.organization_id, a, porHash, orcamento);
      linhas.push({
        organization_id: c.organization_id,
        campaign_id: c.id,
        name: a.name.slice(0, 160),
        status: status(a.status),
        format: a.formato,
        headline: (a.titulos[0] ?? a.titulo).slice(0, 300),
        caption: (a.legendas[0] ?? a.legenda).slice(0, 4000),
        headlines: a.titulos,
        bodies: a.legendas,
        descriptions: a.descricoes,
        images,
        media_url: "",
        thumbnail_url: (a.miniatura || a.imagem).slice(0, 2000),
        link_url: a.link,
        ad_id: a.id.slice(0, 40),
        ad_name: a.name.slice(0, 300),
        created_by: userId,
      });
    }
    const { error } = await admin.from("demand_campaign_creatives").insert(linhas);
    if (error) {
      logger.error("[criativos-meta] importação falhou", { error: error.message });
      return { ok: false, falha: "erro_ao_gravar" };
    }
  }
  return { ok: true, criados: novos.length, existentes: existentes.size };
}
