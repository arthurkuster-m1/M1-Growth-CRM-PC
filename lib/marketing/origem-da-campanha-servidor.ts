import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { emitLeadActivity } from "@/lib/leads/activity-emitter";
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

/**
 * O FORMULÁRIO VENCE a conversa. Se o contato já tinha um lead que NASCEU da conversa (WhatsApp,
 * anúncio, sem origem), o envio do formulário não cria outro: ele ATUALIZA esse lead — respostas,
 * UTMs e a origem do formulário passam a valer — e, se o formulário aponta uma campanha com
 * funil, o lead vai para a primeira etapa dele. Lead que já nasceu de formulário não entra aqui
 * (outro cadastro é outro funil, e a venda segue o último).
 *
 * Devolve o id do lead atualizado, ou `null` quando não há o que adotar (o fluxo normal cria).
 */
export async function adotarLeadDaConversa(
  db: SupabaseClient,
  p: {
    organizationId: string;
    contactId: string;
    origem:
      | (Pick<OrigemCasada, "campanhaId" | "criativoId" | "landingPageId"> & {
          pipelineId: string | null;
        })
      | null;
    customFields: Record<string, unknown>;
    sourceMetadata: Record<string, unknown>;
    webhookSourceId: string;
  },
): Promise<string | null> {
  try {
    const { data } = await db
      .from("crm_leads")
      .select("id, pipeline_id, stage_id, source, custom_fields, source_metadata, status")
      .eq("organization_id", p.organizationId)
      .eq("contact_id", p.contactId)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    const alvo = (data ?? []).find((l) => l.source !== "webhook");
    if (!alvo) return null;

    const patch: Record<string, unknown> = {
      source: "webhook",
      custom_fields: { ...((alvo.custom_fields as object) ?? {}), ...p.customFields },
      source_metadata: {
        ...((alvo.source_metadata as object) ?? {}),
        ...p.sourceMetadata,
        webhook_source_id: p.webhookSourceId,
        origem_do_formulario: true,
      },
    };
    if (p.origem?.campanhaId) {
      patch.demand_campaign_id = p.origem.campanhaId;
      patch.demand_creative_id = p.origem.criativoId;
      patch.demand_landing_page_id = p.origem.landingPageId;
    }
    let moveu = false;
    if (p.origem?.pipelineId && p.origem.pipelineId !== alvo.pipeline_id) {
      const etapa = await primeiraEtapaDoFunil(db, p.organizationId, p.origem.pipelineId);
      if (etapa) {
        patch.pipeline_id = p.origem.pipelineId;
        patch.stage_id = etapa;
        moveu = true;
      }
    }
    const { error } = await db
      .from("crm_leads")
      .update(patch)
      .eq("id", alvo.id as string)
      .eq("organization_id", p.organizationId);
    if (error) {
      // Corrida/conflito (ex.: já há negócio aberto neste funil): o fluxo normal decide.
      logger.warn("[origem-da-campanha] não adotou o lead da conversa", {
        organization_id: p.organizationId,
        error: error.message.slice(0, 120),
      });
      return null;
    }
    await emitLeadActivity(db, {
      organizationId: p.organizationId,
      leadId: alvo.id as string,
      contactId: p.contactId,
      type: "note",
      sourceModule: "webhook",
      sourceId: p.webhookSourceId,
      actor: { type: "webhook_source", id: p.webhookSourceId },
      reason: moveu
        ? "O formulário atualizou o lead: respostas e origem do formulário valem, e ele foi para o funil da campanha."
        : "O formulário atualizou o lead: respostas e origem do formulário passaram a valer.",
      payload: {
        webhook_source_id: p.webhookSourceId,
        demand_campaign_id: p.origem?.campanhaId ?? null,
      },
    });
    return alvo.id as string;
  } catch (e) {
    logger.warn("[origem-da-campanha] erro ao adotar o lead da conversa", {
      organization_id: p.organizationId,
      error: e instanceof Error ? e.message.slice(0, 120) : "erro",
    });
    return null;
  }
}
