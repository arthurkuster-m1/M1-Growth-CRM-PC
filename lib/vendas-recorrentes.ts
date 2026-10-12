/**
 * A RECORRÊNCIA (puro): quando vence a próxima parcela e que lembrete cabe hoje.
 *
 * Regras do Arthur: toda recorrência ativa tem SEMPRE a parcela do próximo mês gerada; ela nasce
 * "prevista" e nunca é dada como paga sozinha — o sistema pergunta (um dia antes/no dia e um dia
 * depois) se o lead pagou e se houve negociação do valor.
 */

/** Soma meses mantendo o dia da cobrança (31 em fevereiro cai no último dia do mês). */
export function somarMesesNaData(data: string, meses: number, diaDaCobranca?: number): string {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  const alvo = m - 1 + meses;
  const ano = a + Math.floor(alvo / 12);
  const mes = ((alvo % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dia = Math.min(diaDaCobranca ?? d, ultimo);
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const dias = (iso: string) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;

export type MomentoDaCobranca = "amanha" | "hoje" | "atrasada";

/**
 * Esta parcela merece um aviso hoje? `amanha`/`hoje` (uma vez, até o vencimento) e `atrasada`
 * (uma vez, depois dele). Fora da janela, ou já avisada, devolve `null`.
 */
export function avisoDaCobranca(
  parcela: { due_on: string; reminded_before_on: string | null; reminded_after_on: string | null },
  hoje: string,
): MomentoDaCobranca | null {
  const falta = dias(parcela.due_on) - dias(hoje);
  if (falta === 1 || falta === 0) {
    if (parcela.reminded_before_on) return null;
    return falta === 1 ? "amanha" : "hoje";
  }
  if (falta < 0) {
    if (parcela.reminded_after_on) return null;
    return "atrasada";
  }
  return null;
}

/** A cobrança já precisa de resposta de alguém? (vence até amanhã ou já venceu) */
export function precisaDeConfirmacao(due_on: string, hoje: string): boolean {
  return dias(due_on) - dias(hoje) <= 1;
}
