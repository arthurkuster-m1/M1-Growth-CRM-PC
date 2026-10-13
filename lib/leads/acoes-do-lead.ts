/**
 * AS AÇÕES que a equipe registra à mão no histórico do cliente (Linha do tempo da ficha).
 * Vocabulário puro, usado pela tela e pela rota.
 */
export const ACOES_DO_LEAD = [
  { id: "ligacao", rotulo: "Follow-up — Ligação", comResultado: true },
  { id: "mensagem", rotulo: "Follow-up — Mensagem enviada", comResultado: false },
  { id: "reuniao", rotulo: "Reunião realizada", comResultado: true },
  { id: "remarcou", rotulo: "Lead remarcou", comResultado: false },
  { id: "nao_atendeu", rotulo: "Não atendeu", comResultado: false },
  { id: "proposta", rotulo: "Proposta enviada", comResultado: false },
  { id: "outro", rotulo: "Outra ação", comResultado: false },
] as const;

export type IdDaAcao = (typeof ACOES_DO_LEAD)[number]["id"];
export const IDS_DAS_ACOES = ACOES_DO_LEAD.map((a) => a.id) as [IdDaAcao, ...IdDaAcao[]];

export const RESULTADOS_DA_LIGACAO = [
  "Atendeu — conversa positiva",
  "Atendeu — pediu para retornar",
  "Atendeu — sem interesse",
  "Não atendeu",
  "Caixa postal",
  "Número errado",
] as const;

/** O texto que fica na linha do tempo. */
export function textoDaAcao(
  id: IdDaAcao,
  resultado: string | null | undefined,
  comentario: string | null | undefined,
): string {
  const acao = ACOES_DO_LEAD.find((a) => a.id === id);
  const partes = [acao?.rotulo ?? "Ação registrada"];
  if (resultado && resultado.trim()) partes.push(`Resultado: ${resultado.trim()}`);
  if (comentario && comentario.trim()) partes.push(comentario.trim());
  return partes.join(" — ").slice(0, 1000);
}
