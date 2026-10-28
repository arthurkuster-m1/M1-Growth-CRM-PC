import { describe, expect, it } from "vitest";

import { alternarVisibilidade, resolverColunas } from "./layout";

const defs = ["a", "b", "c", "d"].map((id) => ({ id, largura: 100 }));

describe("alternarVisibilidade", () => {
  it("ao ligar, entra logo depois da última visível; ao desligar, vai para o fim", () => {
    const p0 = { ordem: ["a", "b", "c", "d"], visiveis: { a: true, b: true, c: false, d: false } };
    const ligouD = alternarVisibilidade(p0, resolverColunas(defs, p0), "d");
    expect(ligouD.ordem).toEqual(["a", "b", "d", "c"]);
    expect(ligouD.visiveis?.d).toBe(true);

    const desligouA = alternarVisibilidade(ligouD, resolverColunas(defs, ligouD), "a");
    expect(desligouA.ordem).toEqual(["b", "d", "c", "a"]);
    expect(desligouA.visiveis?.a).toBe(false);
  });
});
