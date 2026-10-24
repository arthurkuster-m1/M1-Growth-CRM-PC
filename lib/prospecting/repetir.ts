import { searchSchema, type SearchInput } from "./schema";

/**
 * REPETIR UMA EXTRAÇÃO: roda de novo a mesma busca (termo, cidade, limite, modo, teto). O que já
 * está na lista cai na triagem como repetida — só as empresas NOVAS entram na fila —, mas a Apify
 * cobra por tudo o que devolve, então repetir não sai de graça: por isso a tela mostra, antes, o
 * quanto da última rodada foi novidade.
 */

/** A busca original, validada de novo pela régua de hoje; `null` se o registro não serve mais. */
export function buscaParaRepetir(search: unknown): SearchInput | null {
  const lida = searchSchema.safeParse(search);
  return lida.success ? lida.data : null;
}

export interface RendimentoDaBusca {
  /** Quantas das encontradas eram novas, em %; `null` sem nada encontrado. */
  percentualNovo: number | null;
  /** Quase tudo o que ela devolve já estava na lista: repetir tende a pagar por pouco. */
  esgotada: boolean;
}

/** Abaixo disto (com o mínimo de empresas para a conta valer) a busca é tida como esgotada. */
export const PISO_DE_NOVAS_PCT = 20;
const MINIMO_PARA_JULGAR = 10;

export function rendimentoDaBusca(novas: number, repetidas: number): RendimentoDaBusca {
  const encontradas = novas + repetidas;
  if (encontradas <= 0) return { percentualNovo: null, esgotada: false };
  const percentualNovo = Math.round((novas / encontradas) * 100);
  return {
    percentualNovo,
    esgotada: encontradas >= MINIMO_PARA_JULGAR && percentualNovo < PISO_DE_NOVAS_PCT,
  };
}
