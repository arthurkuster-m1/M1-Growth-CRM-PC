/**
 * O QUE UMA VENDA PRECISA TER PARA SER MARCADA COMO PAGA.
 *
 * Venda paga sem produto, sem responsável ou sem forma de pagamento entrava no relatório de
 * Finanças como "sem forma de pagamento" e sem dono: o dinheiro estava lá e não dava para saber de
 * onde veio nem de quem era. A regra é uma só, aplicada no servidor (a tela só explica):
 * assim que há pagamento recebido, a venda tem de ter pelo menos um produto, um responsável e uma
 * forma de pagamento.
 */
export interface EstadoDaVendaParaPagar {
  /** Quantos produtos (itens) a venda terá depois da gravação. */
  itens: number;
  /** O responsável pela venda depois da gravação. */
  responsavelId: string | null | undefined;
  /** A forma de pagamento depois da gravação. */
  forma: string | null | undefined;
}

export type FaltaDaVenda = "produto" | "responsavel" | "forma_de_pagamento";

export const ROTULO_DA_FALTA: Record<FaltaDaVenda, string> = {
  produto: "pelo menos um produto",
  responsavel: "o responsável pela venda",
  forma_de_pagamento: "a forma de pagamento",
};

/** O que falta para a venda poder ser marcada como paga (vazio = pode). */
export function faltaParaPagar(v: EstadoDaVendaParaPagar): FaltaDaVenda[] {
  const falta: FaltaDaVenda[] = [];
  if (v.itens < 1) falta.push("produto");
  if (!v.responsavelId) falta.push("responsavel");
  if (!v.forma?.trim()) falta.push("forma_de_pagamento");
  return falta;
}

/** A frase que a API e a tela mostram. */
export function mensagemDaFalta(falta: readonly FaltaDaVenda[]): string {
  return `Para marcar como pago, informe ${falta.map((f) => ROTULO_DA_FALTA[f]).join(", ")}.`;
}
