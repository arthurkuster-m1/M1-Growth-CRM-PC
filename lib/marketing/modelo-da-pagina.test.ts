import { describe, expect, it } from "vitest";

import { modeloDaPagina } from "./modelos";

describe("modeloDaPagina", () => {
  it("devolve o modelo do tipo da página e nunca o básico genérico", () => {
    expect(modeloDaPagina("mapeamento-do-funil")?.chave).toBe("mapeamento-do-funil");
    expect(modeloDaPagina("produtos-e-ofertas")?.chave).toBe("produtos-e-ofertas");
  });
  it("página sem modelo próprio devolve null (só a página em branco no menu)", () => {
    expect(modeloDaPagina("qualquer-coisa")).toBeNull();
  });
});
