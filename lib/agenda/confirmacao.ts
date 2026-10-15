import type { RespostaDeConfirmacao } from "@/lib/agenda/resposta-de-confirmacao";

/** O texto que a linha do tempo mostra quando o cliente responde ao lembrete. */
export function atividadeDaTransicaoDeConfirmacao(r: RespostaDeConfirmacao): string {
  if (r === "confirmed") return "Cliente confirmou presença";
  if (r === "reschedule") return "Cliente pediu para remarcar";
  return "Cliente pediu para cancelar";
}

/** O selo do compromisso na Agenda. */
export const ROTULO_DA_CONFIRMACAO: Record<RespostaDeConfirmacao, string> = {
  confirmed: "Cliente confirmou",
  reschedule: "Cliente pediu para remarcar",
  cancel: "Cliente pediu para cancelar",
};
