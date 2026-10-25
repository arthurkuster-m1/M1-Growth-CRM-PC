import type { SupabaseClient } from "@supabase/supabase-js";

import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { aplicarTagsAutomaticas } from "@/lib/leads/tags-automaticas";
import { logger } from "@/lib/logger";

import { registrarTentativaNaCadencia } from "./progresso";

/**
 * Uma mensagem do disparo saiu: para o lead da campanha de prospecção isso é a abordagem do dia.
 *  - entra na linha do tempo ("Mensagem do disparo enviada"), SEM nota de abordagem: o painel de
 *    Prospecção já conta o disparo pelos destinatários, e uma nota contaria de novo;
 *  - a cadência dele dá o passo como feito (sem resposta);
 *  - o contato ganha a tag "Abordagem: nome" (com contador), como numa abordagem registrada à mão.
 * Quem responde é do tratamento da resposta (a cadência é encerrada lá). Nunca lança: o envio já
 * aconteceu, e o acompanhamento não pode desfazê-lo.
 */
export async function registrarEnvioDoDisparo(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    contactId: string;
    disparoId: string;
    disparoNome: string;
    demandCampaignId: string | null | undefined;
    approachId: string | null | undefined;
  },
): Promise<"registrado" | "sem_lead"> {
  if (!input.demandCampaignId) return "sem_lead";
  try {
    const { data: lead } = await admin
      .from("crm_leads")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("demand_campaign_id", input.demandCampaignId)
      .eq("contact_id", input.contactId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const leadId = (lead as { id?: string } | null)?.id;
    if (!leadId) return "sem_lead";

    await emitLeadActivity(admin, {
      organizationId: input.organizationId,
      leadId,
      contactId: input.contactId,
      type: "note",
      sourceModule: "disparo",
      sourceId: input.disparoId,
      actor: { type: "webhook_source", id: `campaign:${input.disparoId}` },
      reason: `Mensagem do disparo “${input.disparoNome}” enviada`,
      payload: {
        acao: "disparo_enviado",
        titulo: "Mensagem do disparo enviada",
        disparo_id: input.disparoId,
        ...(input.approachId ? { abordagem_id: input.approachId } : {}),
      },
    });

    await registrarTentativaNaCadencia(admin, {
      organizationId: input.organizationId,
      leadId,
      respondeu: false,
    });

    if (input.approachId) {
      const { data: ab } = await admin
        .from("demand_campaign_approaches")
        .select("name")
        .eq("organization_id", input.organizationId)
        .eq("id", input.approachId)
        .maybeSingle();
      const nome = (ab as { name?: string } | null)?.name?.trim();
      if (nome) {
        const { data: contato } = await admin
          .from("contacts")
          .select("tags")
          .eq("organization_id", input.organizationId)
          .eq("id", input.contactId)
          .maybeSingle();
        const atuais = ((contato as { tags: string[] | null } | null)?.tags ?? []) as string[];
        const tags = aplicarTagsAutomaticas(atuais, {
          fixas: [],
          abordagem: `Abordagem: ${nome}`.slice(0, 54),
        });
        await admin
          .from("contacts")
          .update({ tags })
          .eq("organization_id", input.organizationId)
          .eq("id", input.contactId);
      }
    }
    return "registrado";
  } catch (e) {
    logger.warn("[cadencia] falha ao registrar o envio do disparo", {
      disparo_id: input.disparoId,
      contact_id: input.contactId,
      error: e instanceof Error ? e.message : String(e),
    });
    return "sem_lead";
  }
}
