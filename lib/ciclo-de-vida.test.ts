import { describe, expect, it } from "vitest";

import { CICLOS_DE_VIDA, COR_DO_CICLO, ROTULO_DO_CICLO, ehCicloDeVida } from "./ciclo-de-vida";

describe("ciclo de vida", () => {
  it("todo ciclo tem nome e cor", () => {
    for (const c of CICLOS_DE_VIDA) {
      expect(ROTULO_DO_CICLO[c]).toBeTruthy();
      expect(COR_DO_CICLO[c]).toBeTruthy();
    }
  });
  it("reconhece só os ciclos conhecidos", () => {
    expect(ehCicloDeVida("em_reativacao")).toBe(true);
    expect(ehCicloDeVida("perdido")).toBe(false);
    expect(ehCicloDeVida(null)).toBe(false);
  });
});
