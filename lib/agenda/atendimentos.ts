/**
 * O atendimento muda com o TIPO do compromisso: cada tipo abre uma página de atendimento diferente.
 * Hoje há dois modelos; os próximos (consulta, onboarding…) entram aqui e na configuração da Agenda.
 */
export type ModeloDeAtendimento = "vendas" | "padrao";

export function modeloDoAtendimento(tipo: { nome?: string | null; slug?: string | null } | null): ModeloDeAtendimento {
  const texto = `${tipo?.slug ?? ""} ${tipo?.nome ?? ""}`.toLowerCase();
  return /reuni|venda|comercial|apresenta|diagn/.test(texto) ? "vendas" : "padrao";
}

export const ROTULO_DO_MODELO: Record<ModeloDeAtendimento, string> = {
  vendas: "Reunião de vendas",
  padrao: "Atendimento",
};

/** O roteiro de vendas que aparece como ponto de partida (cada empresa vai editar o seu). */
export const ROTEIRO_DE_VENDAS: Array<{ titulo: string; dica: string }> = [
  { titulo: "Abertura", dica: "Cumprimente, confirme o tempo da reunião e combine como ela vai andar." },
  { titulo: "Diagnóstico", dica: "Entenda a situação atual, a dor principal e o que já tentou." },
  { titulo: "Impacto", dica: "Quanto isso custa hoje (em dinheiro, tempo ou oportunidade)?" },
  { titulo: "Solução", dica: "Mostre só o que resolve a dor que ele contou." },
  { titulo: "Investimento", dica: "Apresente valor, formas de pagamento e o que está incluso." },
  { titulo: "Objeções", dica: "Escute, confirme o que ouviu e responda uma por vez." },
  { titulo: "Fechamento", dica: "Peça a decisão e combine o próximo passo com data." },
];
