import { describe, expect, it } from "vitest";

import { detectarDelimitador, lerTabela } from "./csv";

describe("lerTabela", () => {
  it("lê CSV com ponto e vírgula e acha o separador sozinho", () => {
    expect(lerTabela("Data;Valor;Categoria\n01/11/2026;10,50;Vendas")).toEqual([
      ["Data", "Valor", "Categoria"],
      ["01/11/2026", "10,50", "Vendas"],
    ]);
  });

  it("lê o que o Google Sheets cola (tabulação) e CSV com vírgula", () => {
    expect(lerTabela("a\tb\tc\n1\t2\t3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
    expect(detectarDelimitador("a,b,c\n1,2,3")).toBe(",");
    expect(lerTabela("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("aspas protegem separador e quebra de linha, e aspa dupla vira uma aspa", () => {
    expect(lerTabela('a;"b;c";"d\ne";"f ""g"""')).toEqual([["a", "b;c", "d\ne", 'f "g"']]);
    // o separador entre aspas na primeira linha não conta para a detecção
    expect(detectarDelimitador('"a,b,c";x;y')).toBe(";");
  });

  it("ignora linhas vazias, aceita CRLF e BOM, e mantém célula vazia no meio", () => {
    expect(lerTabela("﻿a;b\r\n\r\n;2\r\n")).toEqual([
      ["a", "b"],
      ["", "2"],
    ]);
  });

  it("texto vazio vira nenhuma linha; última linha sem quebra entra", () => {
    expect(lerTabela("")).toEqual([]);
    expect(lerTabela("x;y")).toEqual([["x", "y"]]);
  });

  it("um delimitador forçado vale mesmo contra a detecção", () => {
    expect(lerTabela("a;b\tc", "\t")).toEqual([["a;b", "c"]]);
  });
});
