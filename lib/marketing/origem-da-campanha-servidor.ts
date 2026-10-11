import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import {
  casarOrigemDaCampanha,
  type CampanhaParaCasar,
  type OrigemCasada,
  type SinaisDeOrigem,
} from "@/lib/marketing/origem-da-campanha";

/**
 * Resolve a origem do lead contra as campanhas da organização — SEM chamar a plataforma de
 * anúncio (a ingestão não pode esperar a rede; ver `hierarquia-do-contato.ts`). Usa o que já
 * está guardado: campanhas atreladas, criativos importados, landing pages e o cache da
 * hierarquia do anúncio. Nunca lança: sem resolução, o lead entra como entrava antes.
 */
export async function resolverOrigemDaCampanha(
  db: SupabaseClient,
  organizationId: string,
  sinais: SinaisDeOrigem,
): Promise<(OrigemCasada & { pipelineId: string | null }) | null> {
  try {
    const { data: campanhas } = await db
      .from("demand_campaigns")
      .select("id, name, pipeline_id, platform_campaigns")
      .eq("organization_id", organizationId)
      .neq("status", "encerrada");
    const lista = (campanhas ?? []) as unknown as CampanhaParaCasar[];
    if (lista.length === 0) return null;

    // O id da campanha da plataforma, pelo cache da hierarquia do anúncio (sem rede).
    let sinaisFinais = sinais;
    if (sinais.adId && !sinais.campanhaDaPlataformaId) {
      const { data: cache } = await db
        .from("ad_hierarchy_cache")
        .select("campaign_id, campaign_name, ad_name")
        .eq("organization_id", organizationId)
        .eq("platform", "meta_ads")
        .eq("ad_id", sinais.adId)
        .maybeSingle();
      if (cache) {
        sinaisFinais = {
          ...sinais,
          campanhaDaPlataformaId: (cache.campaign_id as string | null) ?? null,
          nomeDaCampanha: sinais.nomeDaCampanha ?? (cache.campaign_name as string | null),
          nomeDoAnuncio: sinais.nomeDoAnuncio ?? (cache.ad_name as string | null),
        };
      }
    }

    const ids = lista.map((c) => c.id);
    const [{ data: criativos }, { data: lps }] = await Promise.all([
      db
        .from("demand_campaign_creatives")
        .select("id, campaign_id, ad_id, name, ad_name, link_url")
        .eq("organization_id", organizationId)
        .in("campaign_id", ids),
      db
        .from("demand_campaign_landing_pages")
        .select("id, campaign_id, url")
        .eq("organization_id", organizationId)
        .in("campaign_id", ids),
    ]);

    const origem = casarOrigemDaCampanha(
      lista,
      (criativos ?? []) as never,
      (lps ?? []) as never,
      sinaisFinais,
    );
    if (!origem.campanhaId) return null;
    const campanha = lista.find((c) => c.id === origem.campanhaId);
    return { ...origem, pipelineId: campanha?.pipeline_id ?? null };
  } catch (e) {
    logger.warn("[origem-da-campanha] não resolveu", {
      organization_id: organizationId,
      error: e instanceof Error ? e.message.slice(0, 120) : "erro",
    });
    return null;
  }
}

/** A primeira etapa aberta do funil — onde o lead da campanha nasce. */
export async function primeiraEtapaDoFunil(
  db: SupabaseClient,
  organizationId: string,
  pipelineId: string,
): Promise<string | null> {
  const { data } = await db
    .from("crm_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("pipeline_id", pipelineId)
    .eq("is_archived", false)
    .eq("is_won", false)
    .eq("is_lost", false)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Grava no lead de qual campanha, LP e criativo ele veio. Falha é só registrada. */
export async function carimbarOrigemNoLead(
  db: SupabaseClient,
  organizationId: string,
  leadId: string,
  origem: Pick<OrigemCasada, "campanhaId" | "criativoId" | "landingPageId">,
): Promise<void> {
  if (!origem.campanhaId) return;
  const { error } = await db
    .from("crm_leads")
    .update({
      demand_campaign_id: origem.campanhaId,
      demand_creative_id: origem.criativoId,
      demand_landing_page_id: origem.landingPageId,
    })
    .eq("id", leadId)
    .eq("organization_id", organizationId);
  if (error) {
    logger.warn("[origem-da-campanha] não carimbou o lead", {
      organization_id: organizationId,
      lead_id: leadId,
      error: error.message.slice(0, 120),
    });
  }
}
