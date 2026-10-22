import type { ItemDoCronograma } from "@/lib/marketing/cronograma";

/**
 * A ORDEM das ações e das fases do cronograma, como o painel as desenha: as ações ativas por
 * `ordem`; as fases na ordem em que a primeira ação de cada uma aparece; "sem fase" no fim. Subir
 * e descer reescrevem `ordem` (10, 20, 30…) só onde mudou — sem apagar e recriar nada.
 */
export const naOrdem = (itens: readonly ItemDoCronograma[]): ItemDoCronograma[] =>
  itens.filter((i) => !i.arquivado).sort((a, b) => a.ordem - b.ordem);

/** Os nomes das fases, na ordem em que aparecem (sem a "sem fase"). */
export function nomesDasFases(itens: readonly ItemDoCronograma[]): string[] {
  const nomes: string[] = [];
  for (const i of naOrdem(itens)) {
    const n = i.fase.trim();
    if (n && !nomes.includes(n)) nomes.push(n);
  }
  return nomes;
}

/** Todas as ações ativas na ordem visual: fase por fase, e as sem fase no fim. */
function porFase(itens: readonly ItemDoCronograma[], fases: string[]): ItemDoCronograma[] {
  const ativos = naOrdem(itens);
  return [
    ...fases.flatMap((n) => ativos.filter((i) => i.fase.trim() === n)),
    ...ativos.filter((i) => i.fase.trim() === ""),
  ];
}

/** O que gravar para a lista ficar nesta ordem: só os itens cuja `ordem` mudou. */
export function mudancasDeOrdem(
  itens: readonly ItemDoCronograma[],
  nova: readonly ItemDoCronograma[],
): Array<{ id: string; ordem: number }> {
  const antes = new Map(itens.map((i) => [i.id, i.ordem]));
  return nova
    .map((i, k) => ({ id: i.id, ordem: (k + 1) * 10 }))
    .filter((m) => antes.get(m.id) !== m.ordem);
}

/** Sobe/desce uma ação dentro da fase dela. Sem vizinho naquela direção, não muda nada. */
export function moverAcao(
  itens: readonly ItemDoCronograma[],
  id: string,
  direcao: -1 | 1,
): Array<{ id: string; ordem: number }> {
  const fases = nomesDasFases(itens);
  const todas = porFase(itens, fases);
  const alvo = todas.find((i) => i.id === id);
  if (!alvo) return [];
  const dela = todas.filter((i) => i.fase.trim() === alvo.fase.trim());
  const k = dela.findIndex((i) => i.id === id);
  const j = k + direcao;
  if (j < 0 || j >= dela.length) return [];
  [dela[k], dela[j]] = [dela[j]!, dela[k]!];
  const montada: ItemDoCronograma[] = [];
  for (const n of [...fases, ""]) {
    montada.push(...(n === alvo.fase.trim() ? dela : todas.filter((i) => i.fase.trim() === n)));
  }
  return mudancasDeOrdem(itens, montada);
}

/** Sobe/desce a fase inteira entre as outras fases. */
export function moverFase(
  itens: readonly ItemDoCronograma[],
  nome: string,
  direcao: -1 | 1,
): Array<{ id: string; ordem: number }> {
  const fases = nomesDasFases(itens);
  const k = fases.indexOf(nome);
  const j = k + direcao;
  if (k < 0 || j < 0 || j >= fases.length) return [];
  const novas = [...fases];
  [novas[k], novas[j]] = [novas[j]!, novas[k]!];
  return mudancasDeOrdem(itens, porFase(itens, novas));
}

/** Um nome de fase que ainda não existe ("Nova fase", "Nova fase 2"…). */
export function nomeNovoDeFase(itens: readonly ItemDoCronograma[], base: string): string {
  const existentes = new Set(itens.map((i) => i.fase.trim()));
  if (!existentes.has(base)) return base;
  for (let n = 2; ; n++) if (!existentes.has(`${base} ${n}`)) return `${base} ${n}`;
}
