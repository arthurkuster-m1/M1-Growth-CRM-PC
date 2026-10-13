/**
 * GET /api/v1/demand-campaigns/[id]/meta-por-anuncio?de=AAAA-MM-DD&ate=AAAA-MM-DD
 *
 * Gasto, impressões, cliques no link e visitas à LP de cada ANÚNCIO e de cada CONJUNTO da
 * campanha, somados no período — vindos da base diária (`ad_insights_daily`). Sem período, o da
 * campanha. Alcance não é somado (pessoas únicas não são aditivas entre dias).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const LIMITE = 50_000;

interface Soma {
  spend: number;
  impressions: number;
  link_clicks: number;
  lp_views: number;
}
const zero = (): Soma => ({ spend: 0, impressions: 0, link_clicks: 0, lp_views: 0 });

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);

  const de = dia.safeParse(req.nextUrl.searchParams.get("de"));
  const ate = dia.safeParse(req.nextUrl.searchParams.get("ate"));
  if (!de.success || !ate.success || de.data > ate.data) {
    return fail("validation_failed", a.t("Parâmetros inválidos."), 422, { requestId: a.requestId });
  }

  const { data: c } = await a.supabase
    .from("demand_campaigns")
    .select("id, platform_campaigns, meta_ads_synced_at, meta_ads_diff_pct")
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!c) return campanhaNaoEncontrada(a.t, a.requestId);
  const idsDaPlataforma = ((c.platform_campaigns as Array<{ id: string | null }> | null) ?? [])
    .map((p) => p.id)
    .filter((x): x is string => Boolean(x));
  if (idsDaPlataforma.length === 0) {
    return ok(
      { base: false, anuncios: {}, conjuntos: [], sincronizado_em: null, diferenca_pct: null },
      { requestId: a.requestId },
    );
  }

  // A tabela é da base do servidor: a leitura passa pela autorização acima e filtra a empresa.
  const { data: linhas, error } = await createAdminClient()
    .from("ad_insights_daily")
    .select("ad_id, adset_id, adset_name, spend, impressions, link_clicks, lp_views")
    .eq("organization_id", a.orgId)
    .eq("platform", "meta_ads")
    .in("campaign_id", idsDaPlataforma)
    .gte("day", de.data)
    .lte("day", ate.data)
    .limit(LIMITE);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar os resultados."), 500, {
      requestId: a.requestId,
    });
  }
  const { count } = await createAdminClient()
    .from("ad_insights_daily")
    .select("ad_id", { count: "exact", head: true })
    .eq("organization_id", a.orgId)
    .eq("platform", "meta_ads")
    .in("campaign_id", idsDaPlataforma);

  // O cadastro dos conjuntos (nome e status): conjunto ativo sem entrega no período também entra.
  const { data: cadastro } = await createAdminClient()
    .from("ad_adsets")
    .select("adset_id, name, status, effective_status")
    .eq("organization_id", a.orgId)
    .eq("platform", "meta_ads")
    .in("campaign_id", idsDaPlataforma)
    .limit(2000);
  const statusDe = new Map<string, { nome: string; status: string }>();
  for (const x of (cadastro ?? []) as Array<{
    adset_id: string;
    name: string;
    status: string;
    effective_status: string;
  }>) {
    statusDe.set(x.adset_id, { nome: x.name, status: x.effective_status || x.status });
  }

  const anuncios: Record<string, Soma & { adset_id: string }> = {};
  const conjuntos = new Map<
    string,
    Soma & { adset_id: string; nome: string; anuncios: Set<string> }
  >();
  for (const l of (linhas ?? []) as Array<{
    ad_id: string;
    adset_id: string;
    adset_name: string;
    spend: number | string;
    impressions: number | string;
    link_clicks: number | string;
    lp_views: number | string;
  }>) {
    const v = {
      spend: Number(l.spend) || 0,
      impressions: Number(l.impressions) || 0,
      link_clicks: Number(l.link_clicks) || 0,
      lp_views: Number(l.lp_views) || 0,
    };
    const ad = (anuncios[l.ad_id] ??= { ...zero(), adset_id: l.adset_id });
    ad.spend += v.spend;
    ad.impressions += v.impressions;
    ad.link_clicks += v.link_clicks;
    ad.lp_views += v.lp_views;
    const cj = conjuntos.get(l.adset_id) ?? {
      ...zero(),
      adset_id: l.adset_id,
      nome: l.adset_name,
      anuncios: new Set<string>(),
    };
    cj.spend += v.spend;
    cj.impressions += v.impressions;
    cj.link_clicks += v.link_clicks;
    cj.lp_views += v.lp_views;
    cj.anuncios.add(l.ad_id);
    if (l.adset_name) cj.nome = l.adset_name;
    conjuntos.set(l.adset_id, cj);
  }
  // Conjuntos do cadastro que não tiveram entrega no período entram com zero.
  for (const [adsetId, x] of statusDe) {
    if (!conjuntos.has(adsetId)) {
      conjuntos.set(adsetId, {
        ...zero(),
        adset_id: adsetId,
        nome: x.nome,
        anuncios: new Set<string>(),
      });
    }
  }
  for (const k of Object.keys(anuncios))
    anuncios[k]!.spend = Math.round(anuncios[k]!.spend * 100) / 100;

  return ok(
    {
      base: (count ?? 0) > 0,
      anuncios,
      conjuntos: [...conjuntos.values()]
        .map((x) => ({
          adset_id: x.adset_id,
          nome: x.nome,
          anuncios: x.anuncios.size,
          status: statusDe.get(x.adset_id)?.status ?? "",
          spend: Math.round(x.spend * 100) / 100,
          impressions: x.impressions,
          link_clicks: x.link_clicks,
          lp_views: x.lp_views,
        }))
        // Ativos primeiro; dentro de cada grupo, quem mais gastou.
        .sort(
          (p, q) =>
            Number(q.status === "ACTIVE") - Number(p.status === "ACTIVE") || q.spend - p.spend,
        ),
      sincronizado_em: (c.meta_ads_synced_at as string | null) ?? null,
      diferenca_pct: c.meta_ads_diff_pct === null ? null : Number(c.meta_ads_diff_pct),
    },
    { requestId: a.requestId },
  );
}
