/**
 * Comprou só vale com dinheiro recebido: quando uma tela tenta levar a oportunidade a Comprou sem
 * pagamento, o servidor recusa (`comprou_exige_pagamento`) e a tela pede o pagamento — este
 * evento abre a venda dessa oportunidade, de qualquer lugar do app (quadro, lista, ficha).
 */
export const EVENTO_PAGAMENTO_PEDIDO = "m1:pagamento-pedido";

export function pedirPagamentoDaOportunidade(leadId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_PAGAMENTO_PEDIDO, { detail: { leadId } }));
}

export function ehComprouSemPagamento(erro: unknown): boolean {
  return (erro as { code?: string } | null)?.code === "comprou_exige_pagamento";
}
