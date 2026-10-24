import type { SupabaseClient } from "@supabase/supabase-js";

import { moverLeadParaEtapa } from "@/lib/leads/appointment-stage-move";
import { logger } from "@/lib/logger";

/** Os slugs que o funil de Prospecção ativa dá às etapas de resposta. */
export const SLUG_DA_ETAPA_DE_CONTATO = "contato";
export const SLUG_DA_ETAPA_DE_DECISOR = "contato-com-decisor";

/**
 * O lead respondeu à cadência: ele sobe para "Contato com decisor" (se falou com o decisor) ou
 * "Contato". SÓ para a frente — quem já está adiante não volta — e só se o funil tem a etapa. A
 * mesma régua de campos obrigatórios do arrasto vale (`moverLeadParaEtapa`). Nunca lança.
 */
export async function subirDeEtapaAoResponder(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; decisor: boolean },
): Promise<"movido" | "ja_adiante" | "sem_etapa" | "nao_moveu"> {
  try {
    const { data: lead } = await admin
      .from("crm_leads")
      .select("id, pipeline_id, stage_id, contact_id, status, custom_fields, won_reason")
      .eq("organization_id", input.organizationId)
      .eq("id", input.leadId)
      .maybeSingle();
    if (!lead || (lead as { status: string }).status !== "open") return "nao_moveu";
    const l = lead as {
      id: string;
      pipeline_id: string;
      stage_id: string;
      contact_id: string | null;
      status: string;
      custom_fields: Record<string, unknown> | null;
      won_reason: string | null;
    };
    const { data: etapas } = await admin
      .from("crm_stages")
      .select("id, name, slug, position, is_won, is_lost")
      .eq("organization_id", input.organizationId)
      .eq("pipeline_id", l.pipeline_id)
      .eq("is_archived", false)
      .limit(100);
    const lista = (etapas ?? []) as Array<{
      id: string;
      name: string;
      slug: string;
      position: number;
      is_won: boolean;
      is_lost: boolean;
    }>;
    const atual = lista.find((e) => e.id === l.stage_id);
    const alvo =
      (input.decisor ? lista.find((e) => e.slug === SLUG_DA_ETAPA_DE_DECISOR) : undefined) ??
      lista.find((e) => e.slug === SLUG_DA_ETAPA_DE_CONTATO);
    if (!atual || !alvo) return "sem_etapa";
    if (Number(alvo.position) <= Number(atual.position)) return "ja_adiante";
    const r = await moverLeadParaEtapa(admin, {
      organizationId: input.organizationId,
      leadRow: l,
      etapaRow: alvo,
      origem: { name: atual.name },
      motivoDoMovimento: "cadencia:respondeu",
      sourceModule: "cadencia",
      actorId: "cadence-resposta",
    });
    return r.moveu ? "movido" : "nao_moveu";
  } catch (e) {
    logger.warn("[cadencia] falha ao subir o lead de etapa", {
      lead_id: input.leadId,
      organization_id: input.organizationId,
      error: e instanceof Error ? e.message : String(e),
    });
    return "nao_moveu";
  }
}
