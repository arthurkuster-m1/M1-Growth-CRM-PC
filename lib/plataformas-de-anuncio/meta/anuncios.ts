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
  /** A página de destino do anúncio (sem os parâmetros de UTM); vazio quando o Meta não a expõe. */
  link: string;
  /** TODAS as variações de texto (anúncio dinâmico: até 5 de cada), sem repetir. */
  titulos: string[];
  legendas: string[];
  descricoes: string[];
  /** Endereços das imagens (até 10): a do anúncio, as do carrossel e as do anúncio dinâmico. */
  imagens: string[];
  /** Hashes de imagem do anúncio dinâmico sem endereço (resolvidos depois pela conta). */
  hashesDeImagem: string[];
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
    object_url?: string;
    image_hash?: string;
    object_story_spec?: {
      link_data?: {
        link?: string;
        message?: string;
        name?: string;
        description?: string;
        picture?: string;
        image_hash?: string;
        child_attachments?: Array<{
          link?: string;
          name?: string;
          description?: string;
          picture?: string;
          image_hash?: string;
        }>;
      };
      video_data?: {
        message?: string;
        title?: string;
        image_url?: string;
        call_to_action?: { value?: { link?: string } };
      };
    };
    asset_feed_spec?: {
      link_urls?: Array<{ website_url?: string }>;
      bodies?: Array<{ text?: string }>;
      titles?: Array<{ text?: string }>;
      descriptions?: Array<{ text?: string }>;
      images?: Array<{ hash?: string; url?: string }>;
    };
  };
}

const MAX_VARIACOES_DE_TEXTO = 5;
export const MAX_IMAGENS_DO_ANUNCIO = 10;

/** Textos sem vazio e sem repetição, na ordem em que o Meta os devolve. */
function textosUnicos(
  lista: ReadonlyArray<string | undefined>,
  max: number,
  limite: number,
): string[] {
  const vistos = new Set<string>();
  for (const bruto of lista) {
    const t = (bruto ?? "").trim();
    if (t) vistos.add(t.slice(0, limite));
    if (vistos.size >= max) break;
  }
  return [...vistos];
}

/** As variações do anúncio: onde o Meta guarda cada tipo (dinâmico, carrossel, vídeo, simples). */
export function variacoesDoAnuncio(a: AnuncioCru): Pick<
  AnuncioDoMeta,
  "titulos" | "legendas" | "descricoes" | "imagens" | "hashesDeImagem"
> {
  const c = a.creative;
  const feed = c?.asset_feed_spec;
  const ld = c?.object_story_spec?.link_data;
  const vd = c?.object_story_spec?.video_data;
  const cartoes = ld?.child_attachments ?? [];
  const url = (u: string | undefined) => (u && /^https:\/\/\S+$/i.test(u) ? u : undefined);

  const imagens = [
    c?.image_url,
    ld?.picture,
    vd?.image_url,
    ...(feed?.images ?? []).map((i) => i.url),
    ...cartoes.map((x) => x.picture),
  ]
    .map(url)
    .filter((u): u is string => !!u);
  const hashes = [
    ...(feed?.images ?? []).filter((i) => !i.url).map((i) => i.hash),
    ...cartoes.filter((x) => !x.picture).map((x) => x.image_hash),
  ].filter((h): h is string => !!h && /^[0-9a-f]{8,64}$/i.test(h));

  return {
    titulos: textosUnicos(
      [...(feed?.titles ?? []).map((x) => x.text), c?.title, ld?.name, vd?.title],
      MAX_VARIACOES_DE_TEXTO,
      300,
    ),
    legendas: textosUnicos(
      [...(feed?.bodies ?? []).map((x) => x.text), c?.body, ld?.message, vd?.message],
      MAX_VARIACOES_DE_TEXTO,
      4000,
    ),
    descricoes: textosUnicos(
      [...(feed?.descriptions ?? []).map((x) => x.text), ld?.description],
      MAX_VARIACOES_DE_TEXTO,
      1000,
    ),
    imagens: [...new Set(imagens)].slice(0, MAX_IMAGENS_DO_ANUNCIO),
    hashesDeImagem: [...new Set(hashes)].slice(0, MAX_IMAGENS_DO_ANUNCIO),
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

/** O link de destino: onde cada tipo de anúncio o guarda (link, carrossel, vídeo, dinâmico). */
export function linkDoAnuncio(a: AnuncioCru): string {
  const c = a.creative;
  const candidatos = [
    c?.object_story_spec?.link_data?.link,
    c?.object_story_spec?.link_data?.child_attachments?.find((x) => x.link)?.link,
    c?.object_story_spec?.video_data?.call_to_action?.value?.link,
    c?.asset_feed_spec?.link_urls?.find((x) => x.website_url)?.website_url,
    c?.object_url,
  ];
  const achado = candidatos.find((u) => typeof u === "string" && /^https?:\/\/\S+$/i.test(u));
  return (achado ?? "").slice(0, 1000);
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
    link: linkDoAnuncio(a),
    ...variacoesDoAnuncio(a),
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
          "id,name,effective_status,campaign_id,creative{title,body,thumbnail_url,image_url,image_hash,object_type,video_id,object_url,object_story_spec{link_data{link,message,name,description,picture,image_hash,child_attachments{link,name,description,picture,image_hash}},video_data{message,title,image_url,call_to_action{value{link}}}},asset_feed_spec{link_urls{website_url},bodies,titles,descriptions,images}}",
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

/**
 * Os endereços das imagens a partir dos hashes (anúncio dinâmico guarda só o hash). Uma chamada
 * por conta; o que o Meta não devolver fica de fora.
 */
export async function urlsDasImagens(
  token: string,
  contaId: string,
  hashes: readonly string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = [...new Set(hashes)].slice(0, 100);
  if (unicos.length === 0) return mapa;
  const r = await buscarPaginado<{ hash?: string; url?: string }>(
    montarUrl(`${encodeURIComponent(contaId)}/adimages`, {
      hashes: JSON.stringify(unicos),
      fields: "hash,url",
      limit: "100",
    }),
    token,
    "imagens-do-anuncio",
  );
  if (!r.ok) return mapa;
  for (const i of r.dados) if (i.hash && i.url) mapa.set(i.hash, i.url);
  return mapa;
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

export interface ConjuntoDoMeta {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  campaignId: string;
}

/** Os conjuntos de anúncios das campanhas pedidas — todos, tenham entregado ou não. */
export async function lerConjuntos(
  token: string,
  campanhaIds: readonly string[],
): Promise<Leitura<ConjuntoDoMeta[]>> {
  const todos: ConjuntoDoMeta[] = [];
  for (const id of campanhaIds) {
    const r = await buscarPaginado<{
      id?: string;
      name?: string;
      status?: string;
      effective_status?: string;
      campaign_id?: string;
    }>(
      montarUrl(`${encodeURIComponent(id)}/adsets`, {
        fields: "id,name,status,effective_status,campaign_id",
        limit: "200",
      }),
      token,
      "conjuntos",
    );
    if (!r.ok) return { ok: false, falha: r.falha, detalhe: r.detalhe };
    for (const c of r.dados) {
      if (!c.id) continue;
      todos.push({
        id: c.id,
        name: c.name ?? c.id,
        status: c.status ?? "",
        effectiveStatus: c.effective_status ?? c.status ?? "",
        campaignId: c.campaign_id ?? id,
      });
    }
  }
  return { ok: true, dados: todos };
}
