/**
 * A PLANILHA das tabelas do motor: selecionar células, copiar, colar e apagar como no Excel.
 * Só as contas — onde a seleção está, o que cola em quê —; quem desenha e grava é a tabela.
 */
export interface Posicao {
  /** Índice da linha na lista inteira (a ordem em que as linhas aparecem). */
  l: number;
  /** Índice da coluna visível. */
  c: number;
}

export interface Selecao {
  ancora: Posicao;
  foco: Posicao;
}

export interface Faixa {
  l1: number;
  l2: number;
  c1: number;
  c2: number;
}

export function faixaDa(s: Selecao): Faixa {
  return {
    l1: Math.min(s.ancora.l, s.foco.l),
    l2: Math.max(s.ancora.l, s.foco.l),
    c1: Math.min(s.ancora.c, s.foco.c),
    c2: Math.max(s.ancora.c, s.foco.c),
  };
}

export const dentroDaFaixa = (f: Faixa | null, l: number, c: number): boolean =>
  f !== null && l >= f.l1 && l <= f.l2 && c >= f.c1 && c <= f.c2;

export const ehCelulaUnica = (f: Faixa): boolean => f.l1 === f.l2 && f.c1 === f.c2;

/** A seta (ou Home/End/PageUp/PageDown) que move o foco; fica dentro da tabela. */
export function moverFoco(
  p: Posicao,
  tecla: string,
  limites: { linhas: number; colunas: number },
  ctrl = false,
): Posicao {
  const ultimaL = Math.max(0, limites.linhas - 1);
  const ultimaC = Math.max(0, limites.colunas - 1);
  const preso = (v: number, max: number) => Math.max(0, Math.min(v, max));
  switch (tecla) {
    case "ArrowUp":
      return { l: ctrl ? 0 : preso(p.l - 1, ultimaL), c: p.c };
    case "ArrowDown":
      return { l: ctrl ? ultimaL : preso(p.l + 1, ultimaL), c: p.c };
    case "ArrowLeft":
      return { l: p.l, c: ctrl ? 0 : preso(p.c - 1, ultimaC) };
    case "ArrowRight":
      return { l: p.l, c: ctrl ? ultimaC : preso(p.c + 1, ultimaC) };
    case "Home":
      return { l: p.l, c: 0 };
    case "End":
      return { l: p.l, c: ultimaC };
    case "PageUp":
      return { l: preso(p.l - 10, ultimaL), c: p.c };
    case "PageDown":
      return { l: preso(p.l + 10, ultimaL), c: p.c };
    default:
      return p;
  }
}

/** O texto copiado: colunas separadas por TAB, linhas por quebra de linha (o que o Excel entende). */
export function montarTsv(matriz: readonly (readonly string[])[]): string {
  return matriz
    .map((linha) => linha.map((v) => v.replace(/[\t\r\n]+/g, " ").trim()).join("\t"))
    .join("\n");
}

/** O texto colado em linhas × colunas. Ignora a quebra de linha final que o Excel acrescenta. */
export function lerColagem(texto: string): string[][] {
  const linhas = texto.replace(/\r\n?/g, "\n").split("\n");
  if (linhas.length > 1 && linhas[linhas.length - 1] === "") linhas.pop();
  return linhas.map((l) => l.split("\t"));
}

export interface AlvoDaColagem {
  l: number;
  c: number;
  valor: string;
}

export const LIMITE_DE_CELULAS_POR_COLAGEM = 500;

/**
 * Onde cada valor colado cai. Um valor só sobre uma faixa de várias células preenche a faixa toda
 * (como o Excel); uma grade cola a partir do canto de cima e à esquerda da seleção e para na borda
 * da tabela.
 */
export function alvosDaColagem(
  grade: readonly (readonly string[])[],
  faixa: Faixa,
  limites: { linhas: number; colunas: number },
): AlvoDaColagem[] {
  const alvos: AlvoDaColagem[] = [];
  const umSoValor = grade.length === 1 && grade[0]!.length === 1;
  if (umSoValor && !ehCelulaUnica(faixa)) {
    for (let l = faixa.l1; l <= faixa.l2 && l < limites.linhas; l++) {
      for (let c = faixa.c1; c <= faixa.c2 && c < limites.colunas; c++) {
        alvos.push({ l, c, valor: grade[0]![0]! });
      }
    }
    return alvos;
  }
  grade.forEach((linha, i) => {
    linha.forEach((valor, j) => {
      const l = faixa.l1 + i;
      const c = faixa.c1 + j;
      if (l < limites.linhas && c < limites.colunas) alvos.push({ l, c, valor });
    });
  });
  return alvos;
}

/** Um dia colado ("17/11/2026", "17/11" ou "2026-11-17") como `YYYY-MM-DD`; vazio = `null` (limpa); lixo = `undefined`. */
export function lerDiaDaColagem(texto: string, anoPadrao: number): string | null | undefined {
  const v = texto.trim();
  if (v === "" || v === "—") return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(v);
  let ano: number, mes: number, dia: number;
  if (m) {
    [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  } else {
    m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(v);
    if (!m) return undefined;
    dia = Number(m[1]);
    mes = Number(m[2]);
    ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : anoPadrao;
  }
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return undefined;
  }
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
