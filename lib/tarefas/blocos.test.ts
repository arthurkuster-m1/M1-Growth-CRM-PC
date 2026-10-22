import { describe, expect, it } from "vitest";

import { escreverBlocos, lerBlocos, novoBloco, textoDaDescricao } from "./blocos";

describe("descrição em blocos", () => {
  it("texto antigo vira um bloco de texto por linha", () => {
    const blocos = lerBlocos("um\ndois");
    expect(blocos.map((b) => [b.tipo, b.texto])).toEqual([
      ["texto", "um"],
      ["texto", "dois"],
    ]);
  });

  it("vai e volta sem perder tipo, marcação e filhos", () => {
    const todo = { ...novoBloco("todo", "feito"), marcado: true };
    const toggle = {
      ...novoBloco("toggle", "mais"),
      aberto: true,
      filhos: [novoBloco("h2", "dentro")],
    };
    const lido = lerBlocos(escreverBlocos([todo, toggle]));
    expect(lido[0]).toMatchObject({ tipo: "todo", marcado: true });
    expect(lido[1]?.filhos?.[0]).toMatchObject({ tipo: "h2", texto: "dentro" });
  });

  it("sem nada escrito grava null", () => {
    expect(escreverBlocos([novoBloco(), novoBloco("bullet")])).toBeNull();
  });

  it("JSON quebrado não lança e vira texto", () => {
    expect(lerBlocos('{"v":1,"b":[').length).toBeGreaterThan(0);
  });

  it("o texto corrido serve à busca", () => {
    const salvo = escreverBlocos([novoBloco("h1", "Título"), novoBloco("texto", "corpo")]);
    expect(textoDaDescricao(salvo)).toBe("Título · corpo");
    expect(textoDaDescricao("puro")).toBe("puro");
  });
});
