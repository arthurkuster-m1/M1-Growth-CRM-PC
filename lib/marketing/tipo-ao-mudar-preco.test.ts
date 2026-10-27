import { describe, expect, it } from "vitest";

import { tipoAoMudarOPreco } from "./tipo-ao-mudar-preco";

describe("tipoAoMudarOPreco — digitar um preço em produto sem preço", () => {
  it("gratuito e sob consulta viram único (senão o valor fica escondido atrás do tipo)", () => {
    expect(tipoAoMudarOPreco("gratuito", 588)).toBe("unico");
    expect(tipoAoMudarOPreco("sob-consulta", 1500)).toBe("unico");
  });

  it("único, mensal e setup + mensal não mudam de tipo", () => {
    for (const t of ["unico", "mensal", "setup-mensal"]) {
      expect(tipoAoMudarOPreco(t, 100)).toBeUndefined();
    }
  });

  it("limpar o preço (ou zero) não mexe no tipo", () => {
    expect(tipoAoMudarOPreco("gratuito", null)).toBeUndefined();
    expect(tipoAoMudarOPreco("gratuito", 0)).toBeUndefined();
    expect(tipoAoMudarOPreco("gratuito", undefined)).toBeUndefined();
  });
});
