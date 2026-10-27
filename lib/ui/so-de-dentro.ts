import type { SyntheticEvent } from "react";

/**
 * Para quem envolve uma célula editável (um cartão que abre ao clicar e arrasta ao tocar) e não
 * quer que o clique na célula abra o cartão: para a propagação SÓ do que veio de DENTRO do
 * elemento.
 *
 * Isto importa por causa dos portais. O seletor de data, o menu e a gaveta de uma célula são
 * desenhados fora do elemento (num portal), mas os eventos deles SOBEM pela árvore do React até
 * aqui. Um `stopPropagation()` cego engole o clique na cortina cinza da gaveta, o Radix nunca
 * fica sabendo que a pessoa clicou fora, e a gaveta só fecha pelo "X".
 */
export function soDeDentro(e: SyntheticEvent<HTMLElement>): void {
  if (e.currentTarget.contains(e.target as Node)) e.stopPropagation();
}
