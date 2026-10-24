import { describe, expect, it } from "vitest";

import { buscaParaRepetir, rendimentoDaBusca } from "./repetir";

describe("buscaParaRepetir", () => {
  it("devolve a busca original, com os padrões de hoje para o que faltava", () => {
    const b = buscaParaRepetir({
      name: "clínicas · Batel",
      niche: "clínicas",
      location: "Batel, Curitiba",
      limit: 50,
      budget_usd: 2,
      enrich: false,
    });
    expect(b).toMatchObject({ niche: "clínicas", limit: 50, budget_usd: 2, mode: "completo" });
  });
  it("registro que não passa mais na régua (ou lixo) não é repetido", () => {
    expect(buscaParaRepetir(null)).toBeNull();
    expect(buscaParaRepetir({ niche: "x" })).toBeNull();
    // A completa tem teto menor que o volume: um registro fora da régua é recusado.
    expect(
      buscaParaRepetir({ name: "aa", niche: "aa", location: "bb", mode: "completo", limit: 300 }),
    ).toBeNull();
  });
});

describe("rendimentoDaBusca", () => {
  it("diz quanto da última rodada era novidade", () => {
    expect(rendimentoDaBusca(240, 20)).toEqual({ percentualNovo: 92, esgotada: false });
    expect(rendimentoDaBusca(0, 0)).toEqual({ percentualNovo: null, esgotada: false });
  });
  it("busca que só traz repetidas é dada como esgotada — mas só com amostra suficiente", () => {
    expect(rendimentoDaBusca(5, 95).esgotada).toBe(true);
    expect(rendimentoDaBusca(0, 4).esgotada).toBe(false); // poucas empresas: não dá para julgar
    expect(rendimentoDaBusca(20, 80).esgotada).toBe(false); // exatamente 20%: ainda rende
  });
});
