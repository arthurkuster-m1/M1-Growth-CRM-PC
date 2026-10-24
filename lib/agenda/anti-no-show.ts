import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { HORAS_PARA_AVISAR_SEM_CONFIRMACAO } from "@/lib/agenda/resposta-de-confirmacao";
import { ALVO_DE_VINCULO_DO_AGENDAMENTO } from "@/lib/agenda/tipos";
import { somarTagComContador } from "@/lib/leads/acoes-do-lead";
import { somarDiasUteis } from "@/lib/leads/resultados-rapidos";
import { logger } from "@/lib/logger";

/**
 * O FLUXO ANTI NO-SHOW (migration 0660): por tipo de compromisso, o que fazer para o cliente não
 * faltar e o que registrar quando confirma ou falta. O aviso ao cliente continua sendo o lembrete
 * do tipo; o fluxo cuida do que a EQUIPE faz e do que fica na oportunidade.
 */
export const fluxoSchema = z.object({
  name: z.string().trim().min(1).max(160),
  /** Quantas horas antes, sem confirmação, vira tarefa de ligar. Nulo = não cria. */
  call_hours_before: z.number().int().min(1).max(72).nullable(),
  confirm_tag: z.string().trim().max(30),
  no_show_tag: z.string().trim().max(30),
  /** Em quantos dias úteis a oportunidade volta à fila para remarcar. Nulo = não agenda. */
  remarcar_days: z.number().int().min(0).max(30).nullable(),
  /** Quantas tentativas de remarcar, no total (a primeira no prazo acima). */
  remarcar_attempts: z.number().int().min(1).max(6),
  /** Dias úteis entre uma tentativa sem resposta e a seguinte. */
  remarcar_interval_days: z.number().int().min(1).max(14),
  event_type_ids: z.array(z.string().uuid()).max(100),
});
export type EntradaDoFluxo = z.infer<typeof fluxoSchema>;

export interface FluxoAntiNoShow extends Omit<EntradaDoFluxo, "event_type_ids"> {
  id: string;
  event_type_ids: string[];
}

/** O fluxo que uma empresa nova recebe de modelo ao criar o primeiro. */
export const FLUXO_MODELO: Omit<EntradaDoFluxo, "name" | "event_type_ids"> = {
  call_hours_before: HORAS_PARA_AVISAR_SEM_CONFIRMACAO,
  confirm_tag: "Confirmou",
  no_show_tag: "No Show",
  remarcar_days: 1,
  remarcar_attempts: 3,
  remarcar_interval_days: 2,
};

/** O que a oportunidade diz que fazer: "Remarcar a reunião (faltou)" ou, com várias tentativas, "— tentativa 2 de 3". */
export function textoDaTentativa(tentativa: number, total: number): string {
  return total > 1
    ? `Remarcar a reunião (faltou) — tentativa ${tentativa} de ${total}`
    : "Remarcar a reunião (faltou)";
}

export type EventoDoFluxo = "confirmou" | "faltou";

export const COLUNAS_DO_FLUXO =
  "id, call_hours_before, confirm_tag, no_show_tag, remarcar_days, remarcar_attempts, remarcar_interval_days";

/** O fluxo do tipo de compromisso, ou null (tipo sem fluxo, ou tabela ainda inexistente). */
export async function fluxoDoTipo(
  admin: SupabaseClient,
  organizationId: string,
  eventTypeId: string | null,
) {
  if (!eventTypeId) return null;
  const { data: ligacao } = await admin
    .from("agenda_noshow_flow_types")
    .select("flow_id")
    .eq("organization_id", organizationId)
    .eq("event_type_id", eventTypeId)
    .maybeSingle();
  const flowId = (ligacao as { flow_id?: string } | null)?.flow_id;
  if (!flowId) return null;
  const { data } = await admin
    .from("agenda_noshow_flows")
    .select(COLUNAS_DO_FLUXO)
    .eq("organization_id", organizationId)
    .eq("id", flowId)
    .maybeSingle();
  return (
    (data as {
      id: string;
      call_hours_before: number | null;
      confirm_tag: string;
      no_show_tag: string;
      remarcar_days: number | null;
      remarcar_attempts: number;
      remarcar_interval_days: number;
    } | null) ?? null
  );
}

/**
 * O que o fluxo faz na OPORTUNIDADE e no cliente quando o compromisso confirma ou falta:
 *  - confirmou → tag de confirmação (uma vez);
 *  - faltou → tag de falta (com contador: "No Show: 2x") e, se o fluxo manda, a oportunidade
 *    volta à fila com "Remarcar" para N dias úteis.
 * Nunca lança: o fluxo é acompanhamento, não pode derrubar a confirmação nem o desfecho.
 */
export async function aplicarFluxoAntiNoShow(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    appointmentId: string;
    eventTypeId: string | null;
    contactId: string | null;
    evento: EventoDoFluxo;
    hoje?: string;
  },
): Promise<"aplicado" | "sem_fluxo"> {
  try {
    const fluxo = await fluxoDoTipo(admin, input.organizationId, input.eventTypeId);
    if (!fluxo) return "sem_fluxo";

    const tag = input.evento === "confirmou" ? fluxo.confirm_tag : fluxo.no_show_tag;
    if (tag.trim() && input.contactId) {
      const { data } = await admin
        .from("contacts")
        .select("tags")
        .eq("organization_id", input.organizationId)
        .eq("id", input.contactId)
        .maybeSingle();
      const atuais = ((data as { tags: string[] | null } | null)?.tags ?? []) as string[];
      const novas =
        input.evento === "faltou"
          ? somarTagComContador(atuais, tag)
          : atuais.some((x) => x.toLowerCase() === tag.trim().toLowerCase())
            ? atuais
            : [...atuais, tag.trim().slice(0, 30)];
      if (novas !== atuais) {
        await admin
          .from("contacts")
          .update({ tags: novas })
          .eq("organization_id", input.organizationId)
          .eq("id", input.contactId);
      }
    }

    if (input.evento === "faltou" && fluxo.remarcar_days !== null) {
      const { data: vinculo } = await admin
        .from("crm_lead_links")
        .select("lead_id")
        .eq("organization_id", input.organizationId)
        .eq("target_kind", ALVO_DE_VINCULO_DO_AGENDAMENTO)
        .eq("target_id", input.appointmentId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const leadId = (vinculo as { lead_id?: string } | null)?.lead_id;
      if (leadId) {
        const hoje = input.hoje ?? new Intl.DateTimeFormat("en-CA").format(new Date());
        // Uma remarcação ativa por lead: a anterior (de uma falta antiga) dá lugar à nova.
        await admin
          .from("agenda_noshow_remarcacoes")
          .update({ status: "cancelada" })
          .eq("organization_id", input.organizationId)
          .eq("lead_id", leadId)
          .eq("status", "ativa");
        await admin.from("agenda_noshow_remarcacoes").insert({
          organization_id: input.organizationId,
          lead_id: leadId,
          flow_id: fluxo.id,
          appointment_id: input.appointmentId,
          max_attempts: fluxo.remarcar_attempts,
          interval_days: fluxo.remarcar_interval_days,
        });
        await admin
          .from("crm_leads")
          .update({
            proxima_acao: textoDaTentativa(1, fluxo.remarcar_attempts),
            proxima_acao_em: somarDiasUteis(hoje, fluxo.remarcar_days),
          })
          .eq("organization_id", input.organizationId)
          .eq("id", leadId)
          .eq("status", "open");
      }
    }
    return "aplicado";
  } catch (e) {
    logger.warn("[agenda] fluxo anti no-show falhou", {
      appointment_id: input.appointmentId,
      organization_id: input.organizationId,
      error: e instanceof Error ? e.message : String(e),
    });
    return "sem_fluxo";
  }
}
