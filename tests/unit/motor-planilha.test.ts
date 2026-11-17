import { describe, expect, it } from "vitest";

import {
  alvosDaColagem,
  dentroDaFaixa,
  faixaDa,
  lerColagem,
  lerDiaDaColagem,
  montarTsv,
  moverFoco,
} from "@/lib/motor/planilha";

const LIMITES = { linhas: 5, colunas: 4 };

describe("planilha do motor", () => {
  it("a faixa é o retângulo entre a âncora e o foco, em qualquer direção", () => {
    const f = faixaDa({ ancora: { l: 3, c: 2 }, foco: { l: 1, c: 0 } });
    expect(f).toEqual({ l1: 1, l2: 3, c1: 0, c2: 2 });
    expect(dentroDaFaixa(f, 2, 1)).toBe(true);
    expect(dentroDaFaixa(f, 4, 1)).toBe(false);
    expect(dentroDaFaixa(null, 0, 0)).toBe(false);
  });

  it("as setas andam dentro da tabela e Ctrl vai até a borda", () => {
    expect(moverFoco({ l: 0, c: 0 }, "ArrowUp", LIMITES)).toEqual({ l: 0, c: 0 });
    expect(moverFoco({ l: 0, c: 0 }, "ArrowDown", LIMITES)).toEqual({ l: 1, c: 0 });
    expect(moverFoco({ l: 4, c: 3 }, "ArrowRight", LIMITES)).toEqual({ l: 4, c: 3 });
    expect(moverFoco({ l: 2, c: 2 }, "ArrowRight", LIMITES, true)).toEqual({ l: 2, c: 3 });
    expect(moverFoco({ l: 2, c: 2 }, "ArrowDown", LIMITES, true)).toEqual({ l: 4, c: 2 });
    expect(moverFoco({ l: 2, c: 2 }, "Home", LIMITES)).toEqual({ l: 2, c: 0 });
  });

  it("copia como TSV (TAB e quebra de linha), sem quebrar a grade com texto de várias linhas", () => {
    expect(
      montarTsv([
        ["Ana", "11 9"],
        ["Beto\ncom quebra", "x\ty"],
      ]),
    ).toBe("Ana\t11 9\nBeto com quebra\tx y");
  });

  it("lê a colagem do Excel (CRLF, quebra final) em linhas e colunas", () => {
    expect(lerColagem("a\tb\r\nc\td\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(lerColagem("só um")).toEqual([["só um"]]);
  });

  it("uma grade cola a partir do canto e para na borda da tabela", () => {
    const alvos = alvosDaColagem(
      [
        ["1", "2", "3"],
        ["4", "5", "6"],
      ],
      { l1: 4, l2: 4, c1: 2, c2: 2 },
      LIMITES,
    );
    expect(alvos).toEqual([
      { l: 4, c: 2, valor: "1" },
      { l: 4, c: 3, valor: "2" },
    ]);
  });

  it("um valor sobre uma faixa preenche a faixa toda; sobre uma célula, só ela", () => {
    expect(alvosDaColagem([["x"]], { l1: 0, l2: 1, c1: 0, c2: 1 }, LIMITES)).toHaveLength(4);
    expect(alvosDaColagem([["x"]], { l1: 2, l2: 2, c1: 1, c2: 1 }, LIMITES)).toEqual([
      { l: 2, c: 1, valor: "x" },
    ]);
  });

  it("lê dia colado em vários formatos; vazio limpa e lixo é recusado", () => {
    expect(lerDiaDaColagem("17/11/2026", 2026)).toBe("2026-11-17");
    expect(lerDiaDaColagem("17/11", 2026)).toBe("2026-11-17");
    expect(lerDiaDaColagem("2026-11-17", 2026)).toBe("2026-11-17");
    expect(lerDiaDaColagem("1/2/27", 2026)).toBe("2027-02-01");
    expect(lerDiaDaColagem("", 2026)).toBeNull();
    expect(lerDiaDaColagem("—", 2026)).toBeNull();
    expect(lerDiaDaColagem("31/02/2026", 2026)).toBeUndefined();
    expect(lerDiaDaColagem("amanhã", 2026)).toBeUndefined();
  });
});
