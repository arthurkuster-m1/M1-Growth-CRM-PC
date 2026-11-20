import { describe, expect, it } from "vitest";
import { destacar, existeIgual, filtrarOpcoes, semAcento } from "./busca";

const cats = [
  "Baby",
  "Carro",
  "Casa",
  "Date",
  "Demis",
  "Family",
  "For Art",
  "For Vi",
  "Mercado",
  "Ofertas",
  "Pet",
  "Saúde",
  "Convênio",
].map((label) => ({ label, value: label }));
describe("busca de categorias", () => {
  it("sem acento nem maiúsculas", () => {
    expect(semAcento("Saúde ÇÃO")).toBe("saude cao");
    expect(filtrarOpcoes(cats, "SAU").map((o) => o.label)).toEqual(["Saúde"]);
    expect(filtrarOpcoes(cats, "convenio").map((o) => o.label)).toEqual(["Convênio"]);
  });
  it("texto vazio devolve tudo, na ordem dada", () =>
    expect(filtrarOpcoes(cats, "  ").map((o) => o.label)).toEqual(cats.map((o) => o.label)));
  it("quem COMEÇA com o texto vem antes de quem só contém", () =>
    expect(filtrarOpcoes(cats, "ca").map((o) => o.label)).toEqual(["Carro", "Casa", "Mercado"]));
  it('acha pela segunda palavra ("vi" → For Vi)', () =>
    expect(filtrarOpcoes(cats, "vi").map((o) => o.label)).toContain("For Vi"));
  it("mantém a ordem escolhida dentro de cada grupo", () =>
    expect(
      filtrarOpcoes([{ label: "Zeta casa" }, { label: "Alfa casa" }], "casa").map((o) => o.label),
    ).toEqual(["Zeta casa", "Alfa casa"]));
  it("nada encontrado → lista vazia", () => expect(filtrarOpcoes(cats, "xyz")).toEqual([]));
  it("destaca o trecho digitado, mesmo com acento", () => {
    expect(destacar("Mercado", "erc")).toEqual(["M", "erc", "ado"]);
    expect(destacar("Saúde", "sau")).toEqual(["", "Saú", "de"]);
    expect(destacar("Casa", "")).toEqual(["Casa", "", ""]);
    expect(destacar("Casa", "zz")).toEqual(["Casa", "", ""]);
  });
});

describe("existeIgual", () => {
  const ops = [{ label: "Saúde" }, { label: "Mercado" }];
  it("ignora acento, maiúsculas e espaços nas pontas", () => {
    expect(existeIgual(ops, " saude ")).toBe(true);
    expect(existeIgual(ops, "MERCADO")).toBe(true);
  });
  it("trecho parcial ou vazio não conta como existente", () => {
    expect(existeIgual(ops, "Merc")).toBe(false);
    expect(existeIgual(ops, "   ")).toBe(false);
    expect(existeIgual(ops, "Lazer")).toBe(false);
  });
});
