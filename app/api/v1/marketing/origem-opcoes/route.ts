/**
 * GET /api/v1/marketing/origem-opcoes — as opções de origem em cascata (campanha → conjunto →
 * anúncio → página) e os posicionamentos, para quem corrige a origem de um lead (viewer em diante).
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { montarOpcoesDeOrigem, POSICIONAMENTOS } from "@/lib/marketing/origem-opcoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;
  const supabase = await createClient();

  const [campanhas, criativos, paginas] = await Promise.all([
    supabase
      .from("demand_campaigns")
      .select("id, name, platform_campaigns")
      .eq("organization_id", orgId)
      .order("position", { ascending: true })
      .limit(500),
    supabase
      .from("demand_campaign_creatives")
      .select("id, name, campaign_id, ad_id, link_url")
      .eq("organization_id", orgId)
      .limit(3000),
    supabase
      .from("demand_campaign_landing_pages")
      .select("id, name, campaign_id, url")
      .eq("organization_id", orgId)
      .limit(2000),
  ]);
  if (campanhas.error || criativos.error || paginas.error) {
    return fail("internal_error", "Não foi possível carregar as opções de origem.", 500, {
      requestId,
    });
  }

  // As tabelas da base de anúncios são do servidor: a leitura já passou pelo portão acima.
  const admin = createAdminClient();
  const [dias, conjuntos] = await Promise.all([
    admin
      .from("ad_insights_daily")
      .select("ad_id, adset_id, adset_name, campaign_id")
      .eq("organization_id", orgId)
      .eq("platform", "meta_ads")
      .limit(20000),
    admin
      .from("ad_adsets")
      .select("adset_id, name, campaign_id")
      .eq("organization_id", orgId)
      .eq("platform", "meta_ads")
      .limit(5000),
  ]);

  // A base diária repete cada anúncio por dia: uma linha por anúncio basta.
  const vistos = new Set<string>();
  const anuncioNoConjunto = ((dias.data ?? []) as Array<{
    ad_id: string;
    adset_id: string;
    adset_name: string;
    campaign_id: string;
  }>).filter((l) => {
    if (vistos.has(l.ad_id)) return false;
    vistos.add(l.ad_id);
    return true;
  });

  const arvore = montarOpcoesDeOrigem({
    campanhas: ((campanhas.data ?? []) as Array<{
      id: string;
      name: string;
      platform_campaigns: unknown;
    }>).map((c) => ({
      id: c.id,
      name: c.name,
      platform_campaigns: Array.isArray(c.platform_campaigns)
        ? (c.platform_campaigns as Array<{ id: string | null }>)
        : [],
    })),
    criativos: ((criativos.data ?? []) as Array<{
      id: string;
      name: string;
      campaign_id: string;
      ad_id: string | null;
      link_url: string | null;
    }>).map((k) => ({ ...k, link_url: k.link_url ?? "" })),
    paginas: ((paginas.data ?? []) as Array<{
      id: string;
      name: string;
      campaign_id: string;
      url: string | null;
    }>).map((p) => ({ ...p, url: p.url ?? "" })),
    anuncioNoConjunto,
    conjuntos: (conjuntos.data ?? []) as Array<{
      adset_id: string;
      name: string;
      campaign_id: string;
    }>,
  });

  return ok({ campanhas: arvore, posicionamentos: [...POSICIONAMENTOS] }, { requestId });
}
