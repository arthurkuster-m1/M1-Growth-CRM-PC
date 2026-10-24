import { describe, expect, it } from "vitest";

import { idDaBuscaDoLote } from "./lote-id";
import { combinacoes, linhasDoCampo, planoDoLote } from "./lote";

describe("linhasDoCampo", () => {
  it("uma linha por item, sem vazios nem repetidos", () => {
    expect(linhasDoCampo("  Batel \n\nCentro\nbatel\nA\n  Água   Verde ")).toEqual([
      "Batel",
      "Centro",
      "Água Verde",
    ]);
  });
  it("respeita o máximo", () => {
    expect(linhasDoCampo("aa\nbb\ncc", 2)).toEqual(["aa", "bb"]);
  });
});

describe("planoDoLote", () => {
  it("termos × locais, com o teto total dividido e arredondado para baixo", () => {
    const termos = ["clínicas", "dentistas"];
    const locais = ["Batel", "Centro", "Água Verde"];
    expect(combinacoes(termos, locais)).toHaveLength(6);
    const p = planoDoLote({ termos, locais, limitePorBusca: 50, tetoTotalUsd: 10 });
    expect(p).toMatchObject({ buscas: 6, empresasNoMaximo: 300, tetoPorBuscaUsd: 1.66 });
    // Nunca passa do teto total pedido.
    expect(p.gastoNoMaximoUsd).toBeLessThanOrEqual(10);
    expect(p.motivoInvalido).toBeNull();
  });
  it("recusa lote vazio, grande demais e com teto que dá menos que o mínimo por busca", () => {
    expect(
      planoDoLote({ termos: [], locais: ["a"], limitePorBusca: 10, tetoTotalUsd: 5 })
        .motivoInvalido,
    ).toMatch(/ao menos/);
    const muitos = Array.from({ length: 10 }, (_, i) => `t${i}`);
    expect(
      planoDoLote({ termos: muitos, locais: muitos, limitePorBusca: 10, tetoTotalUsd: 500 })
        .motivoInvalido,
    ).toMatch(/máximo/);
    expect(
      planoDoLote({ termos: ["a", "b"], locais: ["c", "d"], limitePorBusca: 10, tetoTotalUsd: 1 })
        .motivoInvalido,
    ).toMatch(/menos de US\$/);
  });
});

describe("idDaBuscaDoLote", () => {
  it("é estável, tem forma de UUID e muda com o índice", () => {
    const base = "11111111-1111-4111-8111-111111111111";
    expect(idDaBuscaDoLote(base, 0)).toBe(idDaBuscaDoLote(base, 0));
    expect(idDaBuscaDoLote(base, 0)).not.toBe(idDaBuscaDoLote(base, 1));
    expect(idDaBuscaDoLote(base, 3)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
