import { z } from "zod";

/**
 * OS CRIATIVOS DA CAMPANHA (migration 0600): cada anúncio/peça da campanha com legenda, mídia, LP
 * de destino e as métricas de ENTREGA que o Meta informa. Leads, CPL e vendas por criativo vêm
 * do CRM (C5) — nunca do Meta.
 *
 * ⚠️ A FORMA de `STATUS_DO_CRIATIVO` e `FORMATOS_DO_CRIATIVO` é requisito de instrumento (o
 * extrator de `vocabulario-banco-x-typescript` lê `const X = [...] as const`).
 */
export const STATUS_DO_CRIATIVO = ["ativo", "pausado", "encerrado"] as const;
export type StatusDoCriativo = (typeof STATUS_DO_CRIATIVO)[number];

export const FORMATOS_DO_CRIATIVO = ["imagem", "video", "carrossel", "outro"] as const;
export type FormatoDoCriativo = (typeof FORMATOS_DO_CRIATIVO)[number];

export interface Criativo {
  id: string;
  campaign_id: string;
  name: string;
  status: StatusDoCriativo;
  format: FormatoDoCriativo;
  headline: string;
  caption: string;
  media_url: string;
  thumbnail_url: string;
  link_url: string;
  notes: string;
  ad_id: string | null;
  ad_name: string;
  spend: number;
  impressions: number;
  link_clicks: number;
  lp_views: number;
  metrics_synced_at: string | null;
  position: number;
  created_at: string;
}

export const COLUNAS_DO_CRIATIVO =
  "id, campaign_id, name, status, format, headline, caption, media_url, thumbnail_url, link_url, notes, ad_id, ad_name, spend, impressions, link_clicks, lp_views, metrics_synced_at, position, created_at";

const link = z
  .string()
  .trim()
  .max(1000)
  .refine((u) => u === "" || /^https?:\/\/[^\s]+$/i.test(u), { message: "Use um link http(s)." });

const camposSchema = z.object({
  name: z.string().trim().min(1).max(160),
  status: z.enum(STATUS_DO_CRIATIVO),
  format: z.enum(FORMATOS_DO_CRIATIVO),
  headline: z.string().trim().max(300),
  caption: z.string().trim().max(4000),
  media_url: link,
  link_url: link,
  notes: z.string().trim().max(2000),
});

/** Criar: só o nome é obrigatório. */
export const novoCriativoSchema = camposSchema.partial().required({ name: true });

/** Editar: ausente = não mexe (sem `.default()` de propósito — Zod 4 reaplicaria o padrão). */
export const edicaoDeCriativoSchema = camposSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

export function criativoDaLinha(l: Record<string, unknown>): Criativo {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    ...(l as unknown as Criativo),
    spend: n(l.spend),
    impressions: n(l.impressions),
    link_clicks: n(l.link_clicks),
    lp_views: n(l.lp_views),
    position: n(l.position),
  };
}

const razao = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** As taxas de entrega de um criativo (a ausência de denominador é "—", nunca zero). */
export function taxasDoCriativo(
  c: Pick<Criativo, "spend" | "impressions" | "link_clicks" | "lp_views">,
) {
  return {
    ctr: ((r) => (r === null ? null : r * 100))(razao(c.link_clicks, c.impressions)),
    cpc: razao(c.spend, c.link_clicks),
    cpm: ((r) => (r === null ? null : r * 1000))(razao(c.spend, c.impressions)),
    connectRate: ((r) => (r === null ? null : r * 100))(razao(c.lp_views, c.link_clicks)),
    custoPorVisita: razao(c.spend, c.lp_views),
  };
}
