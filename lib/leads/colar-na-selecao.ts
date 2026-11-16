/**
 * COLAR NA SELEÇÃO, como o Excel: copiou UMA célula (ou um bloco) e selecionou várias células →
 * o valor preenche todas elas. Um valor só enche qualquer seleção; um bloco maior é repetido
 * quando a seleção é um múltiplo exato dele (o Excel faz o mesmo). Em qualquer outro caso devolve
 * `null` e quem chama deixa a grade colar do jeito normal (a partir da célula ativa).
 * Puro.
 */
export interface SelecaoDaGrade {
  min: { col: number; row: number };
  max: { col: number; row: number };
}

/** O texto da área de transferência como matriz (tab entre colunas, quebra de linha entre linhas). */
export function matrizDoTextoColado(texto: string): string[][] {
  const limpo = texto.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  return limpo.split("\n").map((linha) => linha.split("\t"));
}

export function colarNaSelecao<L extends Record<string, string | undefined>>(
  linhas: readonly L[],
  idsDasColunas: readonly string[],
  selecao: SelecaoDaGrade,
  matriz: string[][],
): L[] | null {
  const h = matriz.length;
  const w = matriz[0]?.length ?? 0;
  if (h === 0 || w === 0) return null;
  const primeiraColuna = Math.max(0, selecao.min.col);
  // A coluna de situação (a última) nunca recebe valor.
  const ultimaColuna = Math.min(selecao.max.col, idsDasColunas.length - 1);
  const primeiraLinha = Math.max(0, selecao.min.row);
  const ultimaLinha = Math.min(selecao.max.row, linhas.length - 1);
  const nLinhas = ultimaLinha - primeiraLinha + 1;
  const nColunas = ultimaColuna - primeiraColuna + 1;
  if (nLinhas < 1 || nColunas < 1) return null;
  // Seleção que não é maior que o que foi copiado: é um colar comum.
  if (nLinhas * nColunas <= h * w) return null;
  const umValor = h === 1 && w === 1;
  if (!umValor && (nLinhas % h !== 0 || nColunas % w !== 0)) return null;

  const novas = linhas.map((l) => ({ ...l }));
  for (let r = 0; r < nLinhas; r += 1) {
    for (let c = 0; c < nColunas; c += 1) {
      const valor = (matriz[r % h]?.[c % w] ?? "").trim();
      const id = idsDasColunas[primeiraColuna + c]!;
      const linha = novas[primeiraLinha + r]! as Record<string, string | undefined>;
      if (valor === "") delete linha[id];
      else linha[id] = valor;
    }
  }
  return novas;
}
