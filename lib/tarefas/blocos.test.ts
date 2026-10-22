import { describe, expect, it } from "vitest";

import {
  desindentarIds,
  escreverBlocos,
  indentarIds,
  lerBlocos,
  moverIds,
  novoBloco,
  textoDaDescricao,
} from "./blocos";

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

describe("vários blocos de uma vez", () => {
  const faz = (...t: string[]) => t.map((x) => novoBloco("texto", x));
  const nomes = (l: ReturnType<typeof faz>) => l.map((b) => b.texto);

  it("mover leva a seleção inteira, com os filhos, para depois do alvo", () => {
    const [a, b, c, d] = faz("a", "b", "c", "d") as [
      ReturnType<typeof novoBloco>,
      ReturnType<typeof novoBloco>,
      ReturnType<typeof novoBloco>,
      ReturnType<typeof novoBloco>,
    ];
    const r = moverIds([a, b, c, d], new Set([a.id, b.id]), c.id, true);
    expect(nomes(r)).toEqual(["c", "a", "b", "d"]);
    expect(nomes(moverIds([a, b, c, d], new Set([c.id, d.id]), a.id, false))).toEqual([
      "c",
      "d",
      "a",
      "b",
    ]);
  });

  it("soltar sobre a própria seleção não faz nada", () => {
    const [a, b] = faz("a", "b") as [ReturnType<typeof novoBloco>, ReturnType<typeof novoBloco>];
    const lista = [a, b];
    expect(moverIds(lista, new Set([a.id, b.id]), b.id, true)).toBe(lista);
  });

  it("Tab afilha a sequência ao bloco de cima; no primeiro bloco fica onde está", () => {
    const [a, b, c, d] = faz("a", "b", "c", "d") as [
      ReturnType<typeof novoBloco>,
      ReturnType<typeof novoBloco>,
      ReturnType<typeof novoBloco>,
      ReturnType<typeof novoBloco>,
    ];
    const r = indentarIds([a, b, c, d], new Set([b.id, c.id]));
    expect(nomes(r)).toEqual(["a", "d"]);
    expect(nomes(r[0]!.filhos!)).toEqual(["b", "c"]);
    expect(nomes(indentarIds([a, b], new Set([a.id, b.id])))).toEqual(["a", "b"]);
  });

  it("Shift+Tab leva os escolhidos para o nível do pai, logo depois dele", () => {
    const [a, b, c, d] = faz("a", "b", "c", "d") as [
      ReturnType<typeof novoBloco>,
      ReturnType<typeof novoBloco>,
      ReturnType<typeof novoBloco>,
      ReturnType<typeof novoBloco>,
    ];
    const r = desindentarIds([{ ...a, filhos: [b, c] }, d], new Set([b.id, c.id]));
    expect(nomes(r)).toEqual(["a", "b", "c", "d"]);
    expect(r[0]!.filhos).toBeUndefined();
  });
});
