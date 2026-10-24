/**
 * BUSCA EM LOTE: uma lista de termos × uma lista de locais (bairros, cidades) vira uma busca por
 * combinação. É o jeito de passar do limite de uma consulta do Maps (que se esgota bem antes de
 * 100 numa cidade grande): cada bairro devolve as suas, e as repetidas caem na triagem.
 *
 * O dinheiro é decidido ANTES de rodar: o teto total se divide igualmente entre as buscas, e a
 * Apify para cada uma ao atingir a sua parte — então o teto total é garantido, não estimado.
 */
export const MAX_BUSCAS_DO_LOTE = 40;
export const GASTO_MINIMO_POR_BUSCA_USD = 0.5;

/** Uma linha por item: tira espaços, vazios e repetidos (sem diferenciar caixa), mantendo a ordem. */
export function linhasDoCampo(texto: string, max = 20): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim().replace(/\s+/g, " ");
    if (linha.length < 2) continue;
    const chave = linha.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(linha);
    if (saida.length >= max) break;
  }
  return saida;
}

export function combinacoes(
  termos: readonly string[],
  locais: readonly string[],
): Array<{ niche: string; location: string }> {
  return termos.flatMap((niche) => locais.map((location) => ({ niche, location })));
}

export interface PlanoDoLote {
  buscas: number;
  /** O máximo de empresas que o lote pode trazer (buscas × limite de cada). */
  empresasNoMaximo: number;
  /** A parte do teto de cada busca, em dólar (arredondada para baixo: nunca estoura o total). */
  tetoPorBuscaUsd: number;
  /** O que o lote pode gastar, no máximo — nunca passa do teto total pedido. */
  gastoNoMaximoUsd: number;
  motivoInvalido: string | null;
}

export function planoDoLote(p: {
  termos: readonly string[];
  locais: readonly string[];
  limitePorBusca: number;
  tetoTotalUsd: number;
}): PlanoDoLote {
  const buscas = p.termos.length * p.locais.length;
  const tetoPorBuscaUsd = buscas > 0 ? Math.floor((p.tetoTotalUsd / buscas) * 100) / 100 : 0;
  const motivo =
    buscas === 0
      ? "Informe ao menos um termo e um local."
      : buscas > MAX_BUSCAS_DO_LOTE
        ? `O lote tem ${buscas} buscas; o máximo é ${MAX_BUSCAS_DO_LOTE}. Reduza os termos ou os locais.`
        : tetoPorBuscaUsd < GASTO_MINIMO_POR_BUSCA_USD
          ? `O teto total dá menos de US$ ${GASTO_MINIMO_POR_BUSCA_USD.toFixed(2)} por busca. Aumente o teto ou reduza as buscas.`
          : null;
  return {
    buscas,
    empresasNoMaximo: buscas * p.limitePorBusca,
    tetoPorBuscaUsd,
    gastoNoMaximoUsd: Math.round(tetoPorBuscaUsd * buscas * 100) / 100,
    motivoInvalido: motivo,
  };
}
