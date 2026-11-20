export const porOrdem = <T extends { ordem: number; nome: string }>(a: T, b: T) =>
  a.ordem - b.ordem || a.nome.localeCompare(b.nome);

/**
 * Aplica uma nova ordem a UM SUBCONJUNTO da lista (as categorias de um grupo, os grupos de uma seção) e regrava só o que mudou.
 * Renumera a lista COMPLETA (10, 20, 30…) — assim funciona mesmo com ordens repetidas — e preenche, na ordem nova, as
 * posições que o subconjunto ocupava; os itens de fora do subconjunto não saem do lugar.
 */
export function planejarReordem<T extends { id: string; ordem: number; nome: string }>(
  completa: T[],
  subconjuntoNaNovaOrdem: T[],
): { id: string; ordem: number }[] {
  const ordenada = [...completa].sort(porOrdem);
  const ids = new Set(subconjuntoNaNovaOrdem.map((x) => x.id));
  const vagas = ordenada.map((x, k) => (ids.has(x.id) ? k : -1)).filter((k) => k >= 0);
  if (vagas.length !== subconjuntoNaNovaOrdem.length) return [];
  const resultado = ordenada.map((x) => x.id);
  vagas.forEach((k, i) => {
    resultado[k] = subconjuntoNaNovaOrdem[i]!.id;
  });
  const atual = new Map(ordenada.map((x) => [x.id, x.ordem]));
  return resultado
    .map((id, k) => ({ id, ordem: (k + 1) * 10 }))
    .filter((x) => atual.get(x.id) !== x.ordem);
}
