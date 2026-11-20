/**
 * Adapter fino que pluga `aplicaGatilhoDeEvento` no dispatcher do `event_log`.
 * A decisão fica em `gatilho-evento.ts`; aqui só a ligação com o client real.
 */
import { buildContext } from "@/lib/automation/engine";
import { canalDoEventoDesativado } from "@/lib/channels/desativado";
import type { EventHandler, HandlerResult } from "@/lib/event-log/dispatcher";
import { TRIGGER_EVENTS } from "@/lib/schemas/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { aplicaGatilhoDeEvento, createSupabaseGatilhoEventoDb } from "./gatilho-evento";

export const FOLLOWUP_GATILHO_EVENTO_HANDLER_KEY = "followup-gatilho-evento.v1";

export const followupGatilhoEventoHandler: EventHandler = {
  key: FOLLOWUP_GATILHO_EVENTO_HANDLER_KEY,
  naOrgParada: "pula",
  // Assina exatamente o que o seletor de gatilhos deixa escolher (a mesma lista do motor de regras).
  events: [...TRIGGER_EVENTS],
  async handle(row): Promise<HandlerResult> {
    try {
      const admin = createAdminClient();
      // Canal DESATIVADO (#2329): nenhuma automação nasce de mensagem de um canal que o operador desligou.
      if (await canalDoEventoDesativado(admin, row.organization_id, row.payload)) {
        return {
          consumer_key: FOLLOWUP_GATILHO_EVENTO_HANDLER_KEY,
          status: "skipped",
          detail: "canal_desativado",
        };
      }
      const summary = await aplicaGatilhoDeEvento(
        { db: createSupabaseGatilhoEventoDb(admin, (r) => buildContext(admin, r)) },
        row,
      );
      return {
        consumer_key: FOLLOWUP_GATILHO_EVENTO_HANDLER_KEY,
        status: summary.enrolled > 0 ? "ok" : "skipped",
        detail:
          `armados=${summary.pointers_armados} enrolled=${summary.enrolled} ` +
          `ja_vivo=${summary.skipped_existing} condicao=${summary.skipped_condicao}` +
          (summary.motivo_de_pular ? ` pulou=${summary.motivo_de_pular}` : ""),
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { consumer_key: FOLLOWUP_GATILHO_EVENTO_HANDLER_KEY, status: "error", detail };
    }
  },
};
