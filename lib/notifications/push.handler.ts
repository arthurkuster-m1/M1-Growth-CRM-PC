/**
 * O CONSUMIDOR DE NOTIFICAÇÕES do barramento (`event_log`).
 *
 * Para cada evento que pede alguém, `montar-avisos.ts` decide QUEM recebe e O QUE diz, e
 * `entregar-notificacao.ts` grava a notificação de cada pessoa (aviso na tela, por Realtime) e
 * manda o push só para os aparelhos dela.
 *
 * O que notifica:
 *   - `message.received` / `message.group_received` — mensagem nova (responsável da conversa);
 *   - `lead.created`    — lead novo (dono do lead, ou gestores);
 *   - `lead.assigned`   — lead atribuído (só a pessoa que recebeu);
 *   - `user.mentioned`  — menção numa nota interna (só a pessoa mencionada);
 *   - `central.aviso_criado` — os avisos da Central que pedem alguém (migration 0442).
 *
 * "Lead ganho" e "lead perdido" saíram: quem fecha o negócio é quase sempre o próprio dono, e o
 * aviso só repetia para ele o que ele acabou de fazer.
 *
 * O nome da chave (`web-push-inbound.v1`) fica: é o que está gravado em `consumed_by` dos
 * eventos já processados.
 */
import type { EventHandler, EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { canalDoEventoDesativado } from "@/lib/channels/desativado";
import { createAdminClient } from "@/lib/supabase/admin";

import { entregarNotificacao } from "./entregar-notificacao";
import {
  montarAvisoDaCentral,
  montarAvisoDeGrupo,
  montarAvisoDeLeadAtribuido,
  montarAvisoDeLeadNovo,
  montarAvisoDeMencao,
  montarAvisoDeMensagem,
  type Entrega,
} from "./montar-avisos";

export const WEB_PUSH_INBOUND_KEY = "web-push-inbound.v1";

function resultado(status: HandlerResult["status"], detail: string): HandlerResult {
  return { consumer_key: WEB_PUSH_INBOUND_KEY, status, detail };
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

async function montar(row: EventRow): Promise<Entrega | null | "canal_desativado"> {
  const admin = createAdminClient();
  const org = row.organization_id;
  switch (row.event_type) {
    case "message.received":
    case "message.group_received":
      // Canal DESATIVADO (#2329): a inbox nem mostra a conversa — o bolso de ninguém vibra.
      if (await canalDoEventoDesativado(admin, org, row.payload)) return "canal_desativado";
      return row.event_type === "message.received"
        ? montarAvisoDeMensagem(admin, org, row.payload)
        : montarAvisoDeGrupo(admin, org, row.payload);
    case "lead.created": {
      const leadId = texto(row.entity_id) ?? texto(row.payload.lead_id);
      return leadId ? montarAvisoDeLeadNovo(admin, org, leadId, row.metadata ?? {}) : null;
    }
    case "lead.assigned": {
      const leadId = texto(row.payload.lead_id) ?? texto(row.entity_id);
      return leadId
        ? montarAvisoDeLeadAtribuido(admin, org, leadId, texto(row.payload.to_user_id))
        : null;
    }
    case "user.mentioned":
      return montarAvisoDeMencao(admin, org, row.payload);
    case "central.aviso_criado": {
      const itemId = texto(row.payload.item_id) ?? texto(row.entity_id);
      return itemId ? montarAvisoDaCentral(admin, org, itemId) : null;
    }
    default:
      return null;
  }
}

export const webPushInboundHandler: EventHandler = {
  key: WEB_PUSH_INBOUND_KEY,
  naOrgParada: "pula",
  events: [
    "message.received",
    "message.group_received",
    "lead.created",
    "lead.assigned",
    "user.mentioned",
    "central.aviso_criado",
  ],
  async handle(row): Promise<HandlerResult> {
    const entrega = await montar(row);
    if (entrega === "canal_desativado") return resultado("skipped", "canal_desativado");
    if (!entrega || entrega.destinatarios.length === 0)
      return resultado("skipped", "ninguem_a_avisar");
    const { gravadas, push } = await entregarNotificacao(
      createAdminClient(),
      row.organization_id,
      entrega,
      row.id,
    );
    return resultado("ok", `gravadas:${gravadas} push:${push}`);
  },
};
