/**
 * O "Voltar" dos atalhos: funções puras, SEM "use client", para poderem ser chamadas tanto por
 * páginas de servidor quanto pelo botão (que é componente de cliente). Importar `comVoltar` de um
 * arquivo "use client" dentro de uma página de servidor quebra a página inteira.
 */

/** Os parâmetros que um atalho põe no endereço para a página de destino saber como voltar. */
export const PARAM_VOLTAR = "voltar";
export const PARAM_NOME_DO_VOLTAR = "vnome";

/** O endereço de um atalho que, na chegada, mostra "Voltar" para `origem`. */
export function comVoltar(href: string, origem: { href: string; rotulo: string }): string {
  const separador = href.includes("?") ? "&" : "?";
  return `${href}${separador}${PARAM_VOLTAR}=${encodeURIComponent(origem.href)}&${PARAM_NOME_DO_VOLTAR}=${encodeURIComponent(origem.rotulo)}`;
}

/** Só volta para dentro do app: nunca para outro site (`//x`, `https://…`). */
export const caminhoSeguro = (c: string | null): c is string =>
  c !== null && c.startsWith("/app/") && !c.startsWith("//") && !c.includes("\\");
