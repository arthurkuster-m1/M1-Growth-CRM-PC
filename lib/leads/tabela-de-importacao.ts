/**
 * A TABELA de importar leads do CRM (no navegador): ler o que foi colado do Excel/Sheets ou o
 * arquivo CSV, e escrever o modelo para baixar. Puro — sem servidor — para o popup usar direto.
 *
 * O servidor continua sendo quem VALIDA (`lerLinhasDeLeads`): aqui só se separa em células.
 */

/**
 * As colunas do cadastro, na ordem da tabela. Só `Nome` é obrigatória (e telefone ou e-mail para
 * achar a pessoa); o resto é opcional — sem funil o lead fica só guardado, sem venda.
 */
export const COLUNAS_DO_LEAD = [
  { id: "titulo", rotulo: "Nome", obrigatoria: true },
  { id: "telefone", rotulo: "Telefone" },
  { id: "email", rotulo: "E-mail" },
  { id: "origem", rotulo: "Origem" },
  { id: "funil", rotulo: "Funil" },
  { id: "etapa", rotulo: "Etapa" },
  { id: "produto", rotulo: "Produto" },
  { id: "valor", rotulo: "Valor da venda" },
  { id: "status_da_venda", rotulo: "Status da venda" },
  { id: "previsao", rotulo: "Previsão de fechamento" },
  { id: "descricao", rotulo: "Observações" },
  { id: "etiquetas", rotulo: "Etiquetas" },
  { id: "nascimento", rotulo: "Nascimento" },
] as const;

/** Quebra um texto em linhas e células. Aceita tabulação (colar do Excel/Sheets), ; e , (CSV). */
export function lerTextoDeTabela(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const primeira = limpo.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const candidatos = ["\t", ";", ","] as const;
  let sep: string = "\t";
  let melhor = -1;
  for (const c of candidatos) {
    const n = primeira.split(c).length - 1;
    if (n > melhor) {
      melhor = n;
      sep = c;
    }
  }

  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i]!;
    if (aspas) {
      if (ch === '"') {
        if (limpo[i + 1] === '"') {
          celula += '"';
          i++;
        } else aspas = false;
      } else celula += ch;
      continue;
    }
    if (ch === '"' && celula === "") aspas = true;
    else if (ch === sep) {
      linha.push(celula);
      celula = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(celula);
      celula = "";
      linhas.push(linha);
      linha = [];
    } else celula += ch;
  }
  if (celula !== "" || linha.length > 0) {
    linha.push(celula);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

/** Os bytes de um CSV viram texto: UTF-8 e, se não for, Windows-1252 (o Excel em português). */
export function textoDoArquivo(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

const aspar = (c: string) => (/[";\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);

/** CSV com ponto-e-vírgula e BOM — abre direto no Excel em português. */
export function csvDe(linhas: string[][]): string {
  return `﻿${linhas.map((l) => l.map(aspar).join(";")).join("\r\n")}\r\n`;
}

const xml = (c: string) =>
  c.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Planilha `.xls` (SpreadsheetML 2003): abre no Excel, no LibreOffice e no Google Sheets, sem
 * biblioteca. Tudo como texto, para o Excel não "consertar" telefone e data.
 */
export function xlsDe(linhas: string[][], nomeDaAba = "Leads"): string {
  const celulas = (l: string[]) =>
    l.map((c) => `<Cell><Data ss:Type="String">${xml(c)}</Data></Cell>`).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    `<Worksheet ss:Name="${xml(nomeDaAba.slice(0, 31))}"><Table>` +
    linhas.map((l) => `<Row>${celulas(l)}</Row>`).join("") +
    "</Table></Worksheet></Workbook>"
  );
}
