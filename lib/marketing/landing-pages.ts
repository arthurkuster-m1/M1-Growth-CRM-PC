import { z } from "zod";

import type { Criativo } from "@/lib/marketing/criativos";

/**
 * AS LANDING PAGES da campanha (migration 0604): as páginas de destino que rodam nela. Cada LP
 * junta as métricas de ENTREGA dos criativos que apontam para o link dela (gasto, impressões,
 * cliques, visitas); leads e conversão por LP vêm do CRM (C5).
 *
 * ⚠️ A FORMA de `STATUS_DA_LP` é requisito de instrumento (extrator do vocabulário banco×TS).
 */
export const STATUS_DA_LP = ["ativo", "pausado", "encerrado"] as const;
export type StatusDaLp = (typeof STATUS_DA_LP)[number];

export interface LandingPage {
  id: string;
  campaign_id: string;
  name: string;
  url: string;
  status: StatusDaLp;
  notes: string;
  position: number;
  created_at: string;
}

export const COLUNAS_DA_LP = "id, campaign_id, name, url, status, notes, position, created_at";

const link = z
  .string()
  .trim()
  .max(1000)
  .refine((u) => u === "" || /^https?:\/\/[^\s]+$/i.test(u), { message: "Use um link http(s)." });

const camposSchema = z.object({
  name: z.string().trim().min(1).max(160),
  url: link,
  status: z.enum(STATUS_DA_LP),
  notes: z.string().trim().max(2000),
  position: z.number().finite(),
});

export const novaLpSchema = camposSchema.partial().required({ name: true });
export const edicaoDeLpSchema = camposSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

export function lpDaLinha(l: Record<string, unknown>): LandingPage {
  return { ...(l as unknown as LandingPage), position: Number(l.position) || 0 };
}

/** O link sem `www.`, sem parâmetros, sem âncora e sem barra final — para comparar destinos. */
export function chaveDoLink(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export interface MetricasDaLp {
  criativos: number;
  spend: number;
  impressions: number;
  link_clicks: number;
  lp_views: number;
  ctr: number | null;
  cpc: number | null;
  connectRate: number | null;
}

/** Soma os criativos cujo destino é esta LP. */
export function metricasDaLp(
  lp: Pick<LandingPage, "url">,
  criativos: readonly Pick<
    Criativo,
    "link_url" | "spend" | "impressions" | "link_clicks" | "lp_views"
  >[],
): MetricasDaLp {
  const alvo = lp.url ? chaveDoLink(lp.url) : null;
  const meus = alvo ? criativos.filter((c) => c.link_url && chaveDoLink(c.link_url) === alvo) : [];
  const soma = (f: (c: (typeof meus)[number]) => number) => meus.reduce((s, c) => s + f(c), 0);
  const spend = Math.round(soma((c) => c.spend) * 100) / 100;
  const impressions = soma((c) => c.impressions);
  const link_clicks = soma((c) => c.link_clicks);
  const lp_views = soma((c) => c.lp_views);
  return {
    criativos: meus.length,
    spend,
    impressions,
    link_clicks,
    lp_views,
    ctr: impressions > 0 ? (link_clicks / impressions) * 100 : null,
    cpc: link_clicks > 0 ? spend / link_clicks : null,
    connectRate: link_clicks > 0 ? (lp_views / link_clicks) * 100 : null,
  };
}
