/**
 * O produto fala SÓ português (pt-BR). A tradução para outros idiomas foi removida por decisão
 * do produto (11/10/2026): não há seletor de idioma, nem catálogo, nem guarda de tradução.
 *
 * `t("texto")` e `traduzir()` continuam existindo — são o próprio texto, em português —, para
 * não tocar nas centenas de telas que já os chamam. Texto novo pode ser escrito direto, com ou
 * sem `t()`.
 */
import type { Idioma } from "./idiomas";

/** Sem traduções: o português é a chave e o único idioma. */
export const DICIONARIO: Record<string, Partial<Record<string, string>>> = {};

/** Devolve o próprio texto (português). Nunca lança e nunca devolve vazio. */
export function traduzir(texto: string, _idioma?: Idioma): string {
  return texto;
}
