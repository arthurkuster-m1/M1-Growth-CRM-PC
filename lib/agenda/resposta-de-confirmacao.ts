/**
 * A RESPOSTA do cliente ao pedido de confirmação (lembrete): o que ele quis dizer.
 *
 * Conservador de propósito: só vale mensagem CURTA que COMEÇA com a intenção ("1", "sim", "pode
 * remarcar", "cancela"). Frase longa ou ambígua não vira ação — fica para uma pessoa ler. Errar
 * para o lado de não agir é barato; cancelar o compromisso de alguém por engano, não.
 */
export type RespostaDeConfirmacao = "confirmed" | "reschedule" | "cancel";

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const CONFIRMA = /^(1|sim|s|ok|okay|confirmo|confirmado|confirmada|combinado|certo|beleza|blz|pode ser|estarei la|estarei presente|vou sim|vou estar|presente)\b/;
const REMARCA = /^(2|remarc\w*|reagend\w*|outro dia|outro horario|nao posso nesse horario|mudar (o )?horario|adiar)\b/;
const CANCELA = /^(3|cancel\w*|desmarc\w*|nao vou|nao poderei|nao consigo ir|nao quero mais)\b/;

export function classificarRespostaDeConfirmacao(texto: string | null | undefined): RespostaDeConfirmacao | null {
  const t = normalizar(texto ?? "");
  if (t === "" || t.length > 60) return null;
  // Remarcar e cancelar vêm antes: "nao vou" não pode virar "vou sim".
  if (CANCELA.test(t)) return "cancel";
  if (REMARCA.test(t)) return "reschedule";
  if (CONFIRMA.test(t)) return "confirmed";
  return null;
}

/** Quanto tempo antes do início ainda faz sentido tratar uma resposta como confirmação. */
export const JANELA_DA_CONFIRMACAO_HORAS = 72;
/** O aviso "sem confirmação" sai quando faltam este tanto de horas ou menos. */
export const HORAS_PARA_AVISAR_SEM_CONFIRMACAO = 3;
