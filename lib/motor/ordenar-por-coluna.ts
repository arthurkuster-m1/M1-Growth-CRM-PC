import type { ConsultaDaTabela } from "./consulta";

type Ordens = NonNullable<ConsultaDaTabela["ordenacao"]>;

/**
 * O clique no título da coluna, como no Notion: primeiro ordena crescente, o segundo clique
 * decrescente, o terceiro tira a ordenação. Clicar numa coluna nova troca a ordenação inteira
 * (a ordem composta se monta pelo botão "Ordenar").
 */
export function proximaOrdenacao(atual: Ordens | undefined, campo: string): Ordens | undefined {
  const primeira = atual?.[0];
  if (!primeira || primeira.campo !== campo || (atual?.length ?? 0) > 1) {
    return [{ campo, direcao: "asc" }];
  }
  if (primeira.direcao === "asc") return [{ campo, direcao: "desc" }];
  return undefined;
}
