import { describe, expect, it } from "vitest";

import {
  categoriaDaTag,
  categoriaPorRegra,
  corDaCategoria,
  lerConfigDeCategorias,
} from "./categorias";

describe("categoriaPorRegra", () => {
  it("reconhece pelo nome", () => {
    expect(categoriaPorRegra("Campanha: Black Friday")).toBe("tracking");
    expect(categoriaPorRegra("Ad: Kids01")).toBe("tracking");
    expect(categoriaPorRegra("LP: Nova")).toBe("tracking");
    expect(categoriaPorRegra("Conjunto: Frio")).toBe("tracking");
    expect(categoriaPorRegra("Funil: Seletiva")).toBe("funil");
    expect(categoriaPorRegra("MQL")).toBe("qualificacao");
    expect(categoriaPorRegra("No Show")).toBe("acao");
    expect(categoriaPorRegra("No Show: 2x")).toBe("acao");
    expect(categoriaPorRegra("vip")).toBeNull();
  });
});

describe("lerConfigDeCategorias", () => {
  it("sem nada: as quatro padrão", () => {
    const c = lerConfigDeCategorias(null);
    expect(c.categorias.map((x) => x.id)).toEqual(["acao", "tracking", "funil", "qualificacao"]);
  });
  it("a organização muda a cor de uma padrão e cria a sua", () => {
    const c = lerConfigDeCategorias({
      categorias_de_tags: {
        categorias: [
          { id: "tracking", nome: "Rastreio", cor: "#0091ff" },
          { id: "c_vip", nome: "VIP", cor: "#ffb224" },
          { id: "ruim", nome: "x", cor: "nao-e-cor" },
        ],
        tags: { VIP: "c_vip", fantasma: "nao-existe" },
      },
    });
    expect(c.categorias.find((x) => x.id === "tracking")).toMatchObject({ nome: "Rastreio", cor: "#0091ff" });
    expect(c.categorias.some((x) => x.id === "c_vip")).toBe(true);
    expect(c.categorias.some((x) => x.id === "ruim")).toBe(false);
    expect(c.tags).toEqual({ vip: "c_vip" });
  });
});

describe("ordem das categorias", () => {
  it("a ordem guardada vale; o que não foi guardado vai para o fim", () => {
    const c = lerConfigDeCategorias({
      categorias_de_tags: {
        categorias: [
          { id: "funil", nome: "Funil", cor: "#00655a" },
          { id: "c_vip", nome: "VIP", cor: "#ffb224" },
          { id: "acao", nome: "Ação", cor: "#cf3716" },
        ],
        tags: {},
      },
    });
    expect(c.categorias.map((x) => x.id)).toEqual(["funil", "c_vip", "acao", "tracking", "qualificacao"]);
  });
});

describe("categoriaDaTag / corDaCategoria", () => {
  const config = lerConfigDeCategorias({
    categorias_de_tags: {
      categorias: [{ id: "c_vip", nome: "VIP", cor: "#ffb224" }],
      tags: { "compareceu": "c_vip", "no show": "funil" },
    },
  });
  it("a escolha manual vence a regra", () => {
    expect(categoriaDaTag("No Show: 3x", config)?.id).toBe("funil");
    expect(corDaCategoria("Compareceu", config)).toBe("#ffb224");
  });
  it("sem regra e sem escolha: nenhuma", () => {
    expect(categoriaDaTag("vip", config)).toBeNull();
    expect(corDaCategoria("vip", config)).toBeNull();
  });
});

describe("as tags que a abordagem põe sozinha são do funil", () => {
  it("Contato, Contato com decisor e Abordagem: … (com ou sem contador) caem em Funil e ganham a cor dele", () => {
    for (const tag of [
      "Contato",
      "contato",
      "Contato com decisor",
      "Abordagem: Teste - abordagem completa",
      "abordagem: cold call: 3x",
    ]) {
      expect(categoriaPorRegra(tag), tag).toBe("funil");
      expect(categoriaDaTag(tag, null)?.nome, tag).toBe("Funil");
      expect(corDaCategoria(tag, null), tag).toBe("#00655a");
    }
  });
});
