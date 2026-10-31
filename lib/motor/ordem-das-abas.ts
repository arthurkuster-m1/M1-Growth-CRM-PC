/**
 * A ORDEM das abas de visualização de uma tela. Cada aba tem uma `posicao` (a padrão guarda a
 * dela nas preferências da pessoa; as salvas, em `position`). Arrastar uma aba renumera a fila
 * de 1000 em 1000 e devolve só o que mudou de lugar.
 */
export interface PosicaoDaAba {
  id: string;
  posicao: number;
}

export const PASSO_DAS_ABAS = 1000;

/** As abas na ordem em que aparecem. */
export const abasNaOrdem = (abas: readonly PosicaoDaAba[]): PosicaoDaAba[] =>
  [...abas].sort((a, b) => a.posicao - b.posicao);

/** Leva `id` para antes de `antesDeId` (`null` = para o fim) e devolve as posições que mudaram. */
export function reordenarAbas(
  abas: readonly PosicaoDaAba[],
  id: string,
  antesDeId: string | null,
): PosicaoDaAba[] {
  const atual = abasNaOrdem(abas);
  const movida = atual.find((a) => a.id === id);
  if (!movida) return [];
  const resto = atual.filter((a) => a.id !== id);
  const i = antesDeId === null ? resto.length : resto.findIndex((a) => a.id === antesDeId);
  if (i < 0) return [];
  const nova = [...resto.slice(0, i), movida, ...resto.slice(i)];
  const antes = new Map(abas.map((a) => [a.id, a.posicao]));
  return nova
    .map((a, k) => ({ id: a.id, posicao: (k + 1) * PASSO_DAS_ABAS }))
    .filter((a) => antes.get(a.id) !== a.posicao);
}

/**
 * A visualização de fábrica foi apagada? Só vale com outra visão salva de pé: sem nenhuma, a base
 * volta sozinha, para a tela nunca ficar sem visão.
 */
export const baseDaTabelaOculta = (oculta: boolean | undefined, visoesSalvas: number): boolean =>
  oculta === true && visoesSalvas > 0;
