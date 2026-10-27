import type { TIPOS_DE_PRECO } from "@/lib/marketing/blocos";

type TipoDePreco = (typeof TIPOS_DE_PRECO)[number];

/**
 * O tipo de preço depois de a pessoa DIGITAR um valor na tabela de produtos.
 *
 * "Gratuito" e "Sob consulta" não têm valor: o preço digitado era gravado, mas a tabela (e o
 * catálogo da IA) seguiam mostrando o tipo — e o número "aparecia e depois apagava". Quem digita
 * um valor está dizendo que o produto TEM preço: o tipo passa a "Único", e a pessoa troca para
 * "Mensal" etc. se for o caso. `undefined` = o tipo não muda.
 */
export function tipoAoMudarOPreco(
  tipoAtual: TipoDePreco | string,
  novoPreco: number | null | undefined,
): TipoDePreco | undefined {
  if (novoPreco === undefined || novoPreco === null || !(novoPreco > 0)) return undefined;
  return tipoAtual === "gratuito" || tipoAtual === "sob-consulta" ? "unico" : undefined;
}
