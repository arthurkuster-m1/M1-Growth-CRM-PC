/**
 * A ORDEM das colunas da tabela de importar leads: arrastar uma coluna para o lugar de outra.
 * Puro. Soltar X em cima de Y põe X na posição de Y (as outras andam uma casa) — o mesmo gesto
 * no cabeçalho da tabela e na lista do botão "Colunas".
 */
export function moverColuna(ids: readonly string[], idMovido: string, idAlvo: string): string[] {
  const de = ids.indexOf(idMovido);
  const para = ids.indexOf(idAlvo);
  if (de < 0 || para < 0 || de === para) return [...ids];
  const nova = [...ids];
  const [x] = nova.splice(de, 1);
  nova.splice(para, 0, x!);
  return nova;
}

/** Põe `id` no fim da lista, se ainda não está (mostrar uma coluna nova). */
export function mostrarColuna(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [...ids] : [...ids, id];
}

export const ocultarColuna = (ids: readonly string[], id: string): string[] =>
  ids.filter((x) => x !== id);

/** O servidor precisa do nome e de telefone ou e-mail: o que falta na tabela, em palavras. */
export function colunasQueFaltam(ids: readonly string[]): { nome: boolean; contato: boolean } {
  return {
    nome: !ids.includes("titulo"),
    contato: !ids.includes("telefone") && !ids.includes("email"),
  };
}
