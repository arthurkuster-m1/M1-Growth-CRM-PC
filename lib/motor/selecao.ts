/**
 * Seleção de linhas da tabela — a regra do clique, do Shift e do "selecionar todas".
 *
 * Pura e sem React: dá para testar sem montar tela. Opera sobre a lista de ids NA ORDEM
 * em que a tabela mostra, que é o que o Shift precisa para saber o que fica "entre".
 */

/** Liga ou desliga um id, sem alterar o conjunto original. */
export function alternarId(selecionadas: ReadonlySet<string>, id: string): Set<string> {
  const proximo = new Set(selecionadas);
  if (proximo.has(id)) proximo.delete(id);
  else proximo.add(id);
  return proximo;
}

/**
 * Os ids do primeiro ao segundo clique, inclusive, na ordem da tabela — a seleção por
 * faixa do Shift+clique. Id desconhecido (a linha sumiu entre um clique e outro) devolve só
 * o clique atual, em vez de selecionar uma faixa que ninguém viu.
 */
export function faixaEntre(ids: readonly string[], deId: string, ateId: string): string[] {
  const a = ids.indexOf(deId);
  const b = ids.indexOf(ateId);
  if (a < 0 || b < 0) return [ateId];
  const [inicio, fim] = a <= b ? [a, b] : [b, a];
  return ids.slice(inicio, fim + 1);
}

/** Só os ids que ainda existem — a seleção não pode apontar para uma linha apagada. */
export function podarSelecao(
  selecionadas: ReadonlySet<string>,
  ids: readonly string[],
): Set<string> {
  const existentes = new Set(ids);
  return new Set([...selecionadas].filter((id) => existentes.has(id)));
}

export type EstadoDoMarcarTodas = "nenhuma" | "algumas" | "todas";

export function estadoDoMarcarTodas(
  selecionadas: ReadonlySet<string>,
  ids: readonly string[],
): EstadoDoMarcarTodas {
  if (ids.length === 0) return "nenhuma";
  const marcadas = ids.filter((id) => selecionadas.has(id)).length;
  if (marcadas === 0) return "nenhuma";
  return marcadas === ids.length ? "todas" : "algumas";
}
