import { describe, expect, it } from "vitest";

import { criativoDoModelo, nomeComparavel, trocarTag, type ModeloDeCriativo } from "./modelos-de-criativo";

const modelo: ModeloDeCriativo = {
  id: "m1",
  name: "FEM01 - TROCACITY",
  tag: "TROCACITY",
  format: "imagem",
  headlines: ["Venha para TROCACITY", "Seu momento em trocacity"],
  bodies: ["A One Company está em TROCACITY. Inscreva-se!"],
  descriptions: ["Vagas em TROCACITY"],
  link_url: "https://x.com/?cidade=TROCACITY",
  design_url: "https://www.canva.com/design/abc",
  notes: "",
  position: 1,
};

describe("modelos de criativo", () => {
  it("troca a tag em tudo, sem diferenciar maiúsculas", () => {
    expect(trocarTag("A TROCACITY e trocacity", "TROCACITY", "Nova Iguaçu")).toBe("A Nova Iguaçu e Nova Iguaçu");
    expect(trocarTag("texto", "", "x")).toBe("texto");
  });
  it("o criativo nasce planejado, com nome, textos e link trocados e o design intacto", () => {
    const c = criativoDoModelo(modelo, "Nova Iguaçu");
    expect(c).toMatchObject({
      name: "FEM01 - Nova Iguaçu",
      status: "planejado",
      headline: "Venha para Nova Iguaçu",
      caption: "A One Company está em Nova Iguaçu. Inscreva-se!",
      link_url: "https://x.com/?cidade=Nova Iguaçu",
      design_url: "https://www.canva.com/design/abc",
    });
    expect(c.headlines[1]).toBe("Seu momento em Nova Iguaçu");
  });
  it("o nome do Meta casa com o planejado sem acento, caixa nem espaços sobrando", () => {
    expect(nomeComparavel("  FEM01 -  Nova Iguaçu ")).toBe(nomeComparavel("fem01 - nova iguacu"));
  });
});
