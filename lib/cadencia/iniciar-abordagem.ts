import type { SupabaseClient } from "@supabase/supabase-js";

import { moverLeadParaEtapa } from "@/lib/leads/appointment-stage-move";
import { logger } from "@/lib/logger";

/** Os slugs do funil de Prospecção ativa: de onde o lead sai e para onde vai. */
export const SLUG_DO_NOVO_LEAD = "novo-lead";
export const SLUG_DA_ABORDAGEM = "abordagem";

const DE_UMA_VEZ = 10;
const LOTE_DE_LEADS = 200;
/** Teto de leads movidos por chamada: o resto fica em "Novo lead" até a primeira ação sobre ele. */
export const TETO_DE_LEADS_POR_DISPARO = 2000;

interface LinhaDoLead {
  id: string;
  pipeline_id: string;
  stage_id: string;
  contact_id: string | null;
  status: string;
  custom_fields: Record<string, unknown> | null;
  won_reason: string | null;
}

/**
 * O lead que ainda estava em "Novo lead" passa para "Abordagem" — é o que dá a largada da
 * cadência (o gatilho do banco inscreve quem ENTRA em Abordagem). Só mexe em quem está
 * em "Novo lead": quem já avançou fica onde está. Usa a mesma régua de campos obrigatórios do
 * arrasto (`moverLeadParaEtapa`). Nunca lança.
 */
export async function iniciarAbordagemDosLeads(
  admin: SupabaseClient,
  input: { organizationId: string; leadIds: readonly string[]; motivo: string },
): Promise<{ movidos: number; recusados: number }> {
  const resultado = { movidos: 0, recusados: 0 };
  try {
    const ids = [...new Set(input.leadIds)].slice(0, TETO_DE_LEADS_POR_DISPARO);
    const abordagemPorFunil = new Map<string, { id: string; name: string } | null>();
    for (let i = 0; i < ids.length; i += LOTE_DE_LEADS) {
      const { data } = await admin
        .from("crm_leads")
        .select(
          "id, pipeline_id, stage_id, contact_id, status, custom_fields, won_reason, stage:crm_stages!inner(slug, name)",
        )
        .eq("organization_id", input.organizationId)
        .eq("status", "open")
        .eq("crm_stages.slug", SLUG_DO_NOVO_LEAD)
        .in("id", ids.slice(i, i + LOTE_DE_LEADS));
      const leads = (data ?? []) as unknown as Array<LinhaDoLead & { stage: { name: string } }>;
      for (const l of leads) {
        if (!abordagemPorFunil.has(l.pipeline_id)) {
          const { data: etapa } = await admin
            .from("crm_stages")
            .select("id, name")
            .eq("organization_id", input.organizationId)
            .eq("pipeline_id", l.pipeline_id)
            .eq("slug", SLUG_DA_ABORDAGEM)
            .eq("is_archived", false)
            .maybeSingle();
          abordagemPorFunil.set(
            l.pipeline_id,
            (etapa as { id: string; name: string } | null) ?? null,
          );
        }
      }
      for (let j = 0; j < leads.length; j += DE_UMA_VEZ) {
        await Promise.all(
          leads.slice(j, j + DE_UMA_VEZ).map(async (l) => {
            const destino = abordagemPorFunil.get(l.pipeline_id);
            if (!destino) return;
            const { stage, ...leadRow } = l;
            const r = await moverLeadParaEtapa(admin, {
              organizationId: input.organizationId,
              leadRow,
              etapaRow: destino,
              origem: { name: stage.name },
              motivoDoMovimento: input.motivo,
              sourceModule: "cadencia",
              actorId: "cadence-inicio",
            });
            if (r.moveu) resultado.movidos += 1;
            else resultado.recusados += 1;
          }),
        );
      }
    }
  } catch (e) {
    logger.warn("[cadencia] falha ao iniciar a abordagem dos leads", {
      organization_id: input.organizationId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return resultado;
}

/**
 * Um disparo começou: os leads da campanha de prospecção que estão entre os destinatários dele e
 * ainda em "Novo lead" passam para "Abordagem". Disparo avulso (sem campanha de prospecção) não mexe
 * em funil nenhum.
 */
export async function iniciarAbordagemDoDisparo(
  admin: SupabaseClient,
  input: { organizationId: string; disparoId: string; demandCampaignId: string | null | undefined },
): Promise<{ movidos: number; recusados: number }> {
  if (!input.demandCampaignId) return { movidos: 0, recusados: 0 };
  try {
    const { data: destinatarios } = await admin
      .from("campaign_recipients")
      .select("contact_id")
      .eq("organization_id", input.organizationId)
      .eq("campaign_id", input.disparoId)
      .eq("eligibility_status", "eligible")
      .limit(TETO_DE_LEADS_POR_DISPARO);
    const contatos = ((destinatarios ?? []) as Array<{ contact_id: string }>).map(
      (d) => d.contact_id,
    );
    const leadIds: string[] = [];
    for (let i = 0; i < contatos.length; i += LOTE_DE_LEADS) {
      const { data } = await admin
        .from("crm_leads")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("demand_campaign_id", input.demandCampaignId)
        .in("contact_id", contatos.slice(i, i + LOTE_DE_LEADS));
      leadIds.push(...((data ?? []) as Array<{ id: string }>).map((l) => l.id));
    }
    return await iniciarAbordagemDosLeads(admin, {
      organizationId: input.organizationId,
      leadIds,
      motivo: "cadencia:disparo_iniciado",
    });
  } catch (e) {
    logger.warn("[cadencia] falha ao iniciar a abordagem do disparo", {
      disparo_id: input.disparoId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { movidos: 0, recusados: 0 };
  }
}
