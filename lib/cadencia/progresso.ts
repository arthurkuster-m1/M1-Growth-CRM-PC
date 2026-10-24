import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import { aposRegistrarPasso, ordenarPassos } from "./cadencia";

/**
 * Registrar uma abordagem mexe na cadência do lead: se ele RESPONDEU, a inscrição para; se não,
 * o passo é dado como feito e o próximo vence no dia dele. Nunca lança — a cadência é
 * acompanhamento, não pode derrubar o registro da atividade.
 *
 * O cliente é o admin (quem registra pode ser um agente, que não escreve na tabela): o
 * `organizationId` vem da sessão e filtra tudo.
 */
export async function registrarTentativaNaCadencia(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; respondeu: boolean; agora?: Date },
): Promise<"respondeu" | "avancou" | "sem_cadencia"> {
  const agora = input.agora ?? new Date();
  try {
    const { data: inscricao } = await admin
      .from("demand_cadence_enrollments")
      .select("id, cadence_id, current_step, started_at")
      .eq("organization_id", input.organizationId)
      .eq("lead_id", input.leadId)
      .eq("status", "ativa")
      .maybeSingle();
    if (!inscricao) return "sem_cadencia";
    const i = inscricao as {
      id: string;
      cadence_id: string;
      current_step: number;
      started_at: string;
    };
    if (input.respondeu) {
      await admin
        .from("demand_cadence_enrollments")
        .update({ status: "respondeu", finished_at: agora.toISOString(), next_due_at: null })
        .eq("id", i.id)
        .eq("organization_id", input.organizationId)
        .eq("status", "ativa");
      return "respondeu";
    }
    const { data: passos } = await admin
      .from("demand_cadence_steps")
      .select("day_offset")
      .eq("organization_id", input.organizationId)
      .eq("cadence_id", i.cadence_id)
      .limit(100);
    const ordenados = ordenarPassos((passos ?? []) as Array<{ day_offset: number }>);
    // Já passou do último passo (está no prazo de resposta): outra tentativa não muda nada.
    if (i.current_step >= ordenados.length) return "avancou";
    const depois = aposRegistrarPasso(ordenados, i.current_step, new Date(i.started_at), agora);
    await admin
      .from("demand_cadence_enrollments")
      .update({ current_step: depois.current_step, next_due_at: depois.next_due_at.toISOString() })
      .eq("id", i.id)
      .eq("organization_id", input.organizationId)
      .eq("status", "ativa");
    return "avancou";
  } catch (e) {
    logger.warn("[cadencia] falha ao registrar a tentativa", {
      lead_id: input.leadId,
      organization_id: input.organizationId,
      error: e instanceof Error ? e.message : String(e),
    });
    return "sem_cadencia";
  }
}
