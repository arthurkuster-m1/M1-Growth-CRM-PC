import { describe, expect, it } from "vitest";

import { ehCaminhoDeCampanha } from "./embutido";

describe("caminho de campanha", () => {
  it("reconhece só a página de UMA campanha", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(ehCaminhoDeCampanha(`/app/marketing/geracao-de-demanda/campanhas/${id}`)).toBe(true);
    expect(ehCaminhoDeCampanha(`/app/marketing/geracao-de-demanda/campanhas/${id}/`)).toBe(true);
    expect(ehCaminhoDeCampanha("/app/marketing/geracao-de-demanda")).toBe(false);
    expect(ehCaminhoDeCampanha("/app/clientes")).toBe(false);
  });
});
