/**
 * Lê texto de planilha em linhas e colunas — o que "Colar da planilha" (tabulação) e o arquivo CSV
 * (`;` ou `,`) entregam. Sem dependência: aspas duplas protegem o separador e a quebra de linha
 * ("a;b" → uma célula só; "" dentro de aspas é uma aspa), e linhas vazias são ignoradas.
 */
export type Delimitador = "\t" | ";" | ",";

/** O separador mais provável: o que mais aparece na primeira linha com texto (fora das aspas). */
export function detectarDelimitador(texto: string): Delimitador {
  const primeira = texto.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const contagem: Record<Delimitador, number> = { "\t": 0, ";": 0, ",": 0 };
  let dentro = false;
  for (const c of primeira) {
    if (c === '"') dentro = !dentro;
    else if (!dentro && (c === "\t" || c === ";" || c === ",")) contagem[c] += 1;
  }
  const ordem: Delimitador[] = ["\t", ";", ","];
  return ordem.reduce(
    (melhor, d) => (contagem[d] > contagem[melhor] ? d : melhor),
    ";" as Delimitador,
  );
}

export function lerTabela(texto: string, delimitador?: Delimitador): string[][] {
  const sep = delimitador ?? detectarDelimitador(texto);
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let dentro = false;
  const fecharCelula = () => {
    linha.push(celula);
    celula = "";
  };
  const fecharLinha = () => {
    fecharCelula();
    if (linha.some((c) => c.trim() !== "")) linhas.push(linha);
    linha = [];
  };
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (dentro) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          celula += '"';
          i += 1;
        } else dentro = false;
      } else celula += c;
    } else if (c === '"' && celula === "") dentro = true;
    else if (c === sep) fecharCelula();
    else if (c === "\n") fecharLinha();
    else if (c === "\r") {
      if (t[i + 1] === "\n") i += 1;
      fecharLinha();
    } else celula += c;
  }
  if (celula !== "" || linha.length > 0) fecharLinha();
  return linhas;
}
