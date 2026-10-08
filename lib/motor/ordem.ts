/**
 * Ordem manual por arraste — a posição é um `numeric`, e a linha solta entre duas
 * outras recebe o PONTO MÉDIO das vizinhas. Mover uma linha grava uma coluna de uma
 * linha, sem renumerar a lista.
 *
 * O padrão do banco é o epoch em segundos (≈1,8e9), então tarefa nova nasce no fim.
 * Um `double` desse tamanho tem ~2e-7 de resolução: depois de ~20 meios consecutivos
 * entre as mesmas vizinhas a conta deixa de separá-las, e é aí que `lacunaAcabou`
 * manda renumerar a lista (`renumerar`).
 */
export const PASSO_DE_POSICAO = 1;
const LACUNA_MINIMA = 1e-4;

export function posicaoEntre(anterior: number | undefined, proximo: number | undefined): number {
  if (anterior === undefined && proximo === undefined) return 1;
  if (anterior === undefined) return proximo! - PASSO_DE_POSICAO;
  if (proximo === undefined) return anterior + PASSO_DE_POSICAO;
  return (anterior + proximo) / 2;
}

/** Verdadeiro quando não cabe mais nenhum ponto médio entre as duas posições. */
export function lacunaAcabou(anterior: number | undefined, proximo: number | undefined): boolean {
  if (anterior === undefined || proximo === undefined) return false;
  return Math.abs(proximo - anterior) < LACUNA_MINIMA;
}

/** Posições novas, uma por item, a partir da menor existente — espaçadas de 1. */
export function renumerar(posicoes: readonly number[]): number[] {
  const base = posicoes.length ? Math.min(...posicoes) : 0;
  return posicoes.map((_, i) => base + i * PASSO_DE_POSICAO);
}

/** A lista com `idMovido` levado para `indiceDestino` (índice na lista JÁ sem ele). */
export function moverNaLista<T>(
  lista: readonly T[],
  idDe: (item: T) => string,
  idMovido: string,
  indiceDestino: number,
): T[] {
  const origem = lista.findIndex((item) => idDe(item) === idMovido);
  if (origem < 0) return [...lista];
  const copia = [...lista];
  const [item] = copia.splice(origem, 1);
  copia.splice(indiceDestino, 0, item!);
  return copia;
}
