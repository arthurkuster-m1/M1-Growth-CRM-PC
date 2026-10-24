import type { SupabaseClient } from "@supabase/supabase-js";

import { textoDaTentativa } from "@/lib/agenda/anti-no-show";
import { somarDiasUteis } from "@/lib/leads/resultados-rapidos";
import { logger } from "@/lib/logger";

/** O texto que a oportunidade ganha quando as tentativas de remarcar acabam. */
export const TEXTO_DE_REMARCACAO_ESGOTADA = "Sem retorno após as tentativas de remarcar — decidir";

/**
 * Registrar uma abordagem num lead que faltou mexe na mini-cadência de remarcação:
 *  - respondeu → a remarcação termina ("respondeu"); a conversa segue com a pessoa;
 *  - sem resposta → a próxima tentativa vira a "próxima ação" da oportunidade, daqui a N dias úteis;
 *  - acabaram as tentativas → "esgotada", e a oportunidade pede uma decisão.
 * Nunca lança: é acompanhamento do registro, não pode derrubá-lo.
 */
export async function registrarTentativaNaRemarcacao(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; respondeu: boolean; hoje?: string },
): Promise<"respondeu" | "proxima" | "esgotada" | "sem_remarcacao"> {
  try {
    const { data } = await admin
      .from("agenda_noshow_remarcacoes")
      .select("id, attempts_done, max_attempts, interval_days")
      .eq("organization_id", input.organizationId)
      .eq("lead_id", input.leadId)
      .eq("status", "ativa")
      .maybeSingle();
    if (!data) return "sem_remarcacao";
    const r = data as {
      id: string;
      attempts_done: number;
      max_attempts: number;
      interval_days: number;
    };
    if (input.respondeu) {
      await admin
        .from("agenda_noshow_remarcacoes")
        .update({ status: "respondeu" })
        .eq("id", r.id)
        .eq("organization_id", input.organizationId)
        .eq("status", "ativa");
      return "respondeu";
    }
    const feitas = r.attempts_done + 1;
    const hoje = input.hoje ?? new Intl.DateTimeFormat("en-CA").format(new Date());
    if (feitas >= r.max_attempts) {
      await admin
        .from("agenda_noshow_remarcacoes")
        .update({ status: "esgotada", attempts_done: feitas })
        .eq("id", r.id)
        .eq("organization_id", input.organizationId)
        .eq("status", "ativa");
      await admin
        .from("crm_leads")
        .update({ proxima_acao: TEXTO_DE_REMARCACAO_ESGOTADA, proxima_acao_em: hoje })
        .eq("organization_id", input.organizationId)
        .eq("id", input.leadId)
        .eq("status", "open");
      return "esgotada";
    }
    await admin
      .from("agenda_noshow_remarcacoes")
      .update({ attempts_done: feitas })
      .eq("id", r.id)
      .eq("organization_id", input.organizationId)
      .eq("status", "ativa");
    await admin
      .from("crm_leads")
      .update({
        proxima_acao: textoDaTentativa(feitas + 1, r.max_attempts),
        proxima_acao_em: somarDiasUteis(hoje, r.interval_days),
      })
      .eq("organization_id", input.organizationId)
      .eq("id", input.leadId)
      .eq("status", "open");
    return "proxima";
  } catch (e) {
    logger.warn("[agenda] falha na remarcação do anti no-show", {
      lead_id: input.leadId,
      organization_id: input.organizationId,
      error: e instanceof Error ? e.message : String(e),
    });
    return "sem_remarcacao";
  }
}

/** O contato marcou um compromisso novo: as remarcações ativas dos leads dele terminam ("remarcou"). */
export async function encerrarRemarcacoesDoContato(
  admin: SupabaseClient,
  input: { organizationId: string; contactId: string },
): Promise<void> {
  try {
    const { data: leads } = await admin
      .from("crm_leads")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("contact_id", input.contactId)
      .limit(100);
    const ids = ((leads ?? []) as Array<{ id: string }>).map((l) => l.id);
    if (ids.length === 0) return;
    await admin
      .from("agenda_noshow_remarcacoes")
      .update({ status: "remarcou" })
      .eq("organization_id", input.organizationId)
      .eq("status", "ativa")
      .in("lead_id", ids);
  } catch (e) {
    logger.warn("[agenda] falha ao encerrar a remarcação", {
      contact_id: input.contactId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
