import { describe, expect, it } from "vitest";

import { reordenarAbas } from "./ordem-das-abas";

const abas = [
  { id: "padrao", posicao: -1_000_000 },
  { id: "a", posicao: 5 },
  { id: "b", posicao: 9 },
];

describe("ordem das abas", () => {
  it("leva a aba para antes de outra e renumera só o que mudou", () => {
    const r = reordenarAbas(abas, "b", "a");
    expect(r).toEqual([
      { id: "padrao", posicao: 1000 },
      { id: "b", posicao: 2000 },
      { id: "a", posicao: 3000 },
    ]);
  });

  it("para o fim", () => {
    const r = reordenarAbas(abas, "padrao", null);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "padrao"]);
  });

  it("soltar onde já estava não muda nada além da renumeração inicial", () => {
    const certas = [
      { id: "x", posicao: 1000 },
      { id: "y", posicao: 2000 },
    ];
    expect(reordenarAbas(certas, "x", "y")).toEqual([]);
  });

  it("aba que não existe ou alvo que não existe: nada", () => {
    expect(reordenarAbas(abas, "zzz", null)).toEqual([]);
    expect(reordenarAbas(abas, "a", "zzz")).toEqual([]);
  });
});

import { baseDaTabelaOculta } from "./ordem-das-abas";
describe("base da tabela apagada", () => {
  it("só some com outra visão de pé", () => {
    expect(baseDaTabelaOculta(true, 1)).toBe(true);
    expect(baseDaTabelaOculta(true, 0)).toBe(false);
    expect(baseDaTabelaOculta(undefined, 3)).toBe(false);
  });
});
