import { describe, expect, it } from "vitest";

import { colarNaSelecao, matrizDoTextoColado } from "./colar-na-selecao";

const ids = ["titulo", "telefone", "email"];
const linhas: Array<Record<string, string | undefined>> = [
  { titulo: "Ana" },
  { titulo: "Bia" },
  {},
  {},
];
const sel = (c0: number, r0: number, c1: number, r1: number) => ({
  min: { col: c0, row: r0 },
  max: { col: c1, row: r1 },
});

describe("colar na seleção (como o Excel)", () => {
  it("lê o texto colado como matriz", () => {
    expect(matrizDoTextoColado("a\tb\r\nc\td\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(matrizDoTextoColado("só")).toEqual([["só"]]);
  });

  it("um valor preenche todas as células da seleção (3 colunas de uma vez)", () => {
    const r = colarNaSelecao(linhas, ids, sel(0, 0, 2, 0), [["x"]])!;
    expect(r[0]).toEqual({ titulo: "x", telefone: "x", email: "x" });
    expect(r[1]).toEqual({ titulo: "Bia" });
  });

  it("um valor enche um retângulo (várias linhas e colunas) e a lista original não muda", () => {
    const r = colarNaSelecao(linhas, ids, sel(1, 1, 2, 3), [["9"]])!;
    expect(r[1]).toEqual({ titulo: "Bia", telefone: "9", email: "9" });
    expect(r[3]).toEqual({ telefone: "9", email: "9" });
    expect(linhas[1]).toEqual({ titulo: "Bia" });
  });

  it("um bloco é repetido quando a seleção é múltiplo dele", () => {
    const r = colarNaSelecao(linhas, ids, sel(0, 0, 1, 3), [
      ["a", "b"],
      ["c", "d"],
    ])!;
    expect(r.map((l) => [l.titulo, l.telefone])).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("bloco que não encaixa na seleção, ou seleção de uma célula só: deixa a grade colar normal", () => {
    expect(
      colarNaSelecao(linhas, ids, sel(0, 0, 1, 2), [
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toBeNull();
    expect(colarNaSelecao(linhas, ids, sel(0, 0, 0, 0), [["x"]])).toBeNull();
    expect(
      colarNaSelecao(linhas, ids, sel(0, 0, 1, 1), [
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toBeNull();
  });

  it("valor vazio limpa as células, e a coluna de situação (a última) fica de fora", () => {
    const r = colarNaSelecao(linhas, ids, sel(0, 0, 3, 0), [[""]])!;
    expect(r[0]).toEqual({});
    const s = colarNaSelecao(linhas, ids, sel(1, 0, 3, 0), [["z"]])!;
    expect(s[0]).toEqual({ titulo: "Ana", telefone: "z", email: "z" });
  });
});
