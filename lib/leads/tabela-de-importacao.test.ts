import { describe, expect, it } from "vitest";

import { csvDe, lerTextoDeTabela, textoDoArquivo, xlsDe } from "./tabela-de-importacao";

describe("lerTextoDeTabela", () => {
  it("cola do Excel: tabulação", () => {
    expect(lerTextoDeTabela("Nome\tTelefone\nAna\t11999998888\nBia\t")).toEqual([
      ["Nome", "Telefone"],
      ["Ana", "11999998888"],
      ["Bia", ""],
    ]);
  });
  it("CSV com ponto-e-vírgula e aspas", () => {
    expect(lerTextoDeTabela('Nome;Obs\r\n"Silva; Ana";"disse ""oi"""\r\n')).toEqual([
      ["Nome", "Obs"],
      ["Silva; Ana", 'disse "oi"'],
    ]);
  });
  it("CSV com vírgula e quebra de linha dentro da célula", () => {
    expect(lerTextoDeTabela('a,b\n"linha 1\nlinha 2",x')).toEqual([
      ["a", "b"],
      ["linha 1\nlinha 2", "x"],
    ]);
  });
  it("ignora linhas vazias e o BOM", () => {
    expect(lerTextoDeTabela("﻿Nome\tX\n\t\nAna\t1")).toEqual([
      ["Nome", "X"],
      ["Ana", "1"],
    ]);
  });
});

describe("modelo para baixar", () => {
  it("csv volta a ser lido igual", () => {
    const linhas = [["Nome", "Obs"], ["Ana", "a;b"]];
    expect(lerTextoDeTabela(csvDe(linhas))).toEqual(linhas);
  });
  it("xls escapa o que é de XML", () => {
    expect(xlsDe([["A&B", "<x>"]])).toContain("A&amp;B");
    expect(xlsDe([["A&B", "<x>"]])).toContain("&lt;x&gt;");
  });
  it("arquivo em Windows-1252 é lido com os acentos", () => {
    const bytes = new Uint8Array([0x4a, 0x6f, 0xe3, 0x6f]); // "João" em latin-1
    expect(textoDoArquivo(bytes.buffer)).toBe("João");
  });
});
