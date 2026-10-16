/**
 * "Novo agendamento" em QUALQUER tela (Agenda, CRM, ficha, Início, Inbox) abre a MESMA página do
 * compromisso, no centro da tela. Este evento é o caminho único: quem quer marcar chama
 * `abrirNovoCompromisso`, e o componente global (`NovoCompromissoGlobal`, no casco do app) abre.
 */
export const EVENTO_NOVO_COMPROMISSO = "m1:novo-compromisso";

export interface PedidoDeNovoCompromisso {
  contactId?: string | null;
  leadId?: string | null;
  conversationId?: string | null;
  /** ISO com fuso: o horário já escolhido (clique num bloco livre da grade). */
  startsAt?: string | null;
  /** O tipo de atendimento já escolhido. */
  eventTypeId?: string | null;
}

export function abrirNovoCompromisso(pedido: PedidoDeNovoCompromisso = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_NOVO_COMPROMISSO, { detail: pedido }));
}
