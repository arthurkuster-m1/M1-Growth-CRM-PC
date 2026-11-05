/**
 * A MENSAGEM HUMANA PRESA: escrita na Inbox com o número fora do ar.
 *
 * O envio pela Inbox grava a mensagem como `queued` com `metadata.queued_reason =
 * 'channel_session_not_working'` quando a sessão do canal não está conectada. O reenvio automático
 * (`redriveQueued`, no reconciliador do worker) só cobre o que a IA, uma automação ou o sistema
 * mandaram (`sent_via in ('ai','automation','system')`): a de uma PESSOA não sai sozinha quando o
 * número volta — e mandar sozinha uma frase de horas atrás, sem contexto, seria pior. Decisão do
 * dono (05/11/2026): nada sai sem a pessoa decidir; a mensagem mostra a verdade e ganha "Reenviar".
 *
 * Uma regra só, usada pela tela (para oferecer o botão) e pela rota (para aceitar o pedido).
 */
export const MOTIVO_NUMERO_FORA_DO_AR = "channel_session_not_working";

export interface MensagemParaReenvio {
  direction: string;
  status: string;
  sent_via: string | null;
  type: string;
  metadata?: Record<string, unknown> | null;
}

/** Foi uma pessoa que escreveu, ficou na fila por causa do número e dá para reenviar do jeito que está? */
export function mensagemEsperaReenvio(m: MensagemParaReenvio): boolean {
  return (
    m.direction === "outbound" &&
    m.status === "queued" &&
    (m.sent_via === "user" || m.sent_via === "crm") &&
    m.metadata?.queued_reason === MOTIVO_NUMERO_FORA_DO_AR &&
    // Modelo (template) carrega valores que a linha não guarda: reenvia-se pelo compositor.
    m.type !== "template"
  );
}
