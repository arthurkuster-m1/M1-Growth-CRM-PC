/**
 * A RESPOSTA do cliente ao lembrete vira confirmação no compromisso.
 *
 * Escuta `message.received`: se o cliente tem compromisso próximo, já avisado por lembrete e ainda
 * sem resposta, uma resposta curta ("1", "sim", "remarcar", "cancela") é registrada no compromisso
 * e na linha do tempo. Remarcar e cancelar NÃO agem sozinhos: abrem uma tarefa para o responsável
 * (decisão humana). Presença continua sendo declarada por uma pessoa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { atividadeDaTransicaoDeConfirmacao } from "@/lib/agenda/confirmacao";
import {
  JANELA_DA_CONFIRMACAO_HORAS,
  classificarRespostaDeConfirmacao,
  type RespostaDeConfirmacao,
} from "@/lib/agenda/resposta-de-confirmacao";
import { ALVO_DE_VINCULO_DO_AGENDAMENTO } from "@/lib/agenda/tipos";
import type { EventHandler, HandlerResult } from "@/lib/event-log/dispatcher";
import { textoDoPayloadInbound } from "@/lib/followup/aplicar-inbound";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarTarefaInterna } from "@/lib/tarefas/criar-tarefa";

export const AGENDA_CONFIRMACAO_HANDLER_KEY = "agenda-resposta-de-confirmacao.v1";

const quando = (iso: string, fuso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export async function aplicarRespostaDeConfirmacao(
  admin: SupabaseClient,
  args: { org: string; contactId: string; texto: string; agora?: Date },
): Promise<{ aplicou: boolean; resposta: RespostaDeConfirmacao | null; appointmentId?: string }> {
  const resposta = classificarRespostaDeConfirmacao(args.texto);
  if (!resposta) return { aplicou: false, resposta: null };
  const agora = args.agora ?? new Date();
  const de = new Date(agora.getTime() - 3_600_000).toISOString();
  const ate = new Date(agora.getTime() + JANELA_DA_CONFIRMACAO_HORAS * 3_600_000).toISOString();

  // O compromisso a que a resposta se refere: o mais próximo que já recebeu lembrete e não tem resposta.
  const { data: candidatos } = await admin
    .from("calendar_appointments")
    .select("id, starts_at, time_zone, owner_user_id, title, status")
    .eq("organization_id", args.org)
    .eq("contact_id", args.contactId)
    .in("status", ["pending", "confirmed"])
    .is("client_confirmation", null)
    .not("reminder_sent_at", "is", null)
    .gte("starts_at", de)
    .lte("starts_at", ate)
    .order("starts_at", { ascending: true })
    .limit(1);
  const alvo = (candidatos ?? [])[0] as
    | { id: string; starts_at: string; time_zone: string; owner_user_id: string | null; title: string }
    | undefined;
  if (!alvo) return { aplicou: false, resposta };

  const { error } = await admin
    .from("calendar_appointments")
    .update({ client_confirmation: resposta, client_confirmed_at: agora.toISOString() })
    .eq("organization_id", args.org)
    .eq("id", alvo.id)
    .is("client_confirmation", null);
  if (error) {
    logger.error("[agenda] resposta de confirmação não gravada", { erro: error.message });
    return { aplicou: false, resposta };
  }

  // A oportunidade do compromisso: o vínculo gravado na marcação.
  const { data: vinculo } = await admin
    .from("crm_lead_links")
    .select("lead_id")
    .eq("organization_id", args.org)
    .eq("target_kind", ALVO_DE_VINCULO_DO_AGENDAMENTO)
    .eq("target_id", alvo.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const leadId = (vinculo as { lead_id?: string } | null)?.lead_id ?? null;
  const dia = quando(alvo.starts_at, alvo.time_zone);
  const titulo = atividadeDaTransicaoDeConfirmacao(resposta);

  if (leadId) {
    await emitLeadActivity(admin, {
      organizationId: args.org,
      leadId,
      contactId: args.contactId,
      type: "note",
      sourceModule: "agenda",
      sourceId: alvo.id,
      actor: { type: "api_token", id: "agenda-confirmacao" },
      reason: `${titulo} — ${dia}`,
      payload: { acao: "confirmacao_do_cliente", titulo, resposta },
    }).catch(() => undefined);
  }

  if (resposta !== "confirmed" && alvo.owner_user_id) {
    await criarTarefaInterna(admin, {
      organizationId: args.org,
      titulo:
        resposta === "reschedule"
          ? `Cliente pediu para remarcar: ${alvo.title} (${dia})`
          : `Cliente pediu para cancelar: ${alvo.title} (${dia})`,
      venceEmDias: 0,
      atribuirA: { usuario_id: alvo.owner_user_id },
      prioridade: "high",
      contactId: args.contactId,
      leadId,
      descricao: "Resposta do cliente ao lembrete. Abra o compromisso na Agenda e decida.",
      origem: "agenda:resposta_de_confirmacao",
    }).catch(() => undefined);
  }
  return { aplicou: true, resposta, appointmentId: alvo.id };
}

export const agendaRespostaDeConfirmacaoHandler: EventHandler = {
  key: AGENDA_CONFIRMACAO_HANDLER_KEY,
  // Escrita interna curta no banco (e uma tarefa): segue normal.
  naOrgParada: "roda",
  events: ["message.received"],
  async handle(row): Promise<HandlerResult> {
    try {
      const contactId = typeof row.payload.contact_id === "string" ? row.payload.contact_id : null;
      const texto = textoDoPayloadInbound(row.payload);
      if (!contactId || !texto) {
        return { consumer_key: AGENDA_CONFIRMACAO_HANDLER_KEY, status: "skipped", detail: "sem_texto" };
      }
      const r = await aplicarRespostaDeConfirmacao(createAdminClient(), {
        org: row.organization_id,
        contactId,
        texto,
      });
      return {
        consumer_key: AGENDA_CONFIRMACAO_HANDLER_KEY,
        status: r.aplicou ? "ok" : "skipped",
        detail: r.aplicou ? `resposta=${r.resposta}` : "sem_compromisso_aguardando",
      };
    } catch (err) {
      return {
        consumer_key: AGENDA_CONFIRMACAO_HANDLER_KEY,
        status: "error",
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
