import type { SupabaseClient } from "@supabase/supabase-js";

import {
  aplicarTagsAutomaticas,
  tagDeEstadoDoFunil,
  TAG_CONTATO,
} from "@/lib/leads/tags-automaticas";
import { logger } from "@/lib/logger";
import { garantirCategoriaDoFunil } from "@/lib/tags/categoria-do-funil";

import { registrarTentativaNaCadencia } from "./progresso";
import { subirDeEtapaAoResponder } from "./subir-de-etapa";

/**
 * O lead respondeu a um disparo da campanha de prospecção: é "Contato". A cadência dele termina,
 * ele sobe de etapa (só para a frente) e ganha a marca "Contato · Funil", como numa ação
 * registrada à mão. Nunca lança — a resposta já está no inbox de qualquer jeito.
 */
export async function aoLeadResponderNoDisparo(
  admin: SupabaseClient,
  input: { organizationId: string; contactId: string; disparoId: string },
): Promise<"registrado" | "sem_lead"> {
  try {
    const { data: disparo } = await admin
      .from("campaigns")
      .select("demand_campaign_id")
      .eq("organization_id", input.organizationId)
      .eq("id", input.disparoId)
      .maybeSingle();
    const demanda = (disparo as { demand_campaign_id?: string | null } | null)?.demand_campaign_id;
    if (!demanda) return "sem_lead";
    const { data: lead } = await admin
      .from("crm_leads")
      .select("id, pipeline_id")
      .eq("organization_id", input.organizationId)
      .eq("demand_campaign_id", demanda)
      .eq("contact_id", input.contactId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const l = lead as { id: string; pipeline_id: string } | null;
    if (!l) return "sem_lead";

    const resultado = await registrarTentativaNaCadencia(admin, {
      organizationId: input.organizationId,
      leadId: l.id,
      respondeu: true,
    });
    if (resultado === "respondeu") {
      await subirDeEtapaAoResponder(admin, {
        organizationId: input.organizationId,
        leadId: l.id,
        decisor: false,
      });
    }

    const { data: funil } = await admin
      .from("crm_pipelines")
      .select("name")
      .eq("organization_id", input.organizationId)
      .eq("id", l.pipeline_id)
      .maybeSingle();
    const nomeDoFunil = (funil as { name?: string } | null)?.name ?? "";
    const tag = tagDeEstadoDoFunil(TAG_CONTATO, nomeDoFunil);
    const { data: contato } = await admin
      .from("contacts")
      .select("tags")
      .eq("organization_id", input.organizationId)
      .eq("id", input.contactId)
      .maybeSingle();
    const atuais = ((contato as { tags: string[] | null } | null)?.tags ?? []) as string[];
    await admin
      .from("contacts")
      .update({ tags: aplicarTagsAutomaticas(atuais, { fixas: [tag], abordagem: null }) })
      .eq("organization_id", input.organizationId)
      .eq("id", input.contactId);
    await garantirCategoriaDoFunil(admin, {
      organizationId: input.organizationId,
      pipelineId: l.pipeline_id,
      nomeDoFunil,
      tags: [tag],
    });
    return "registrado";
  } catch (e) {
    logger.warn("[cadencia] falha ao registrar a resposta do disparo", {
      disparo_id: input.disparoId,
      contact_id: input.contactId,
      error: e instanceof Error ? e.message : String(e),
    });
    return "sem_lead";
  }
}
