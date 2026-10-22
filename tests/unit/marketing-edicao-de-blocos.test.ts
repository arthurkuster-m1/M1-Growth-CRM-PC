import { describe, expect, it } from "vitest";

import { blocoEmBranco, type Bloco } from "@/lib/marketing/blocos";
import {
  alvoDoAtalho,
  aplicarPropriedade,
  converterBloco,
  duplicarBlocos,
  moverBlocos,
  propriedadesDoBloco,
  removerBlocos,
} from "@/lib/marketing/edicao-de-blocos";

const texto = (id: string, t: string): Bloco => ({ id, tipo: "texto", texto: t });

describe("edição visual dos blocos de Marketing", () => {
  it("os atalhos 0 a 9 apontam para os dez blocos de texto", () => {
    const tipos = "1234567890".split("").map((d) => {
      const a = alvoDoAtalho(d)!;
      return `${a.tipo}${a.nivel ?? ""}${a.estilo ?? ""}`;
    });
    expect(tipos).toEqual([
      "titulo1",
      "titulo2",
      "titulo3",
      "listacheck",
      "listamarcadores",
      "listanumerada",
      "toggle",
      "citacao",
      "destaque",
      "texto",
    ]);
  });

  it("converter mantém o id e leva o texto", () => {
    const b = texto("a", "Linha um\nLinha dois");
    const lista = converterBloco(b, alvoDoAtalho("5")!);
    expect(lista).toMatchObject({
      id: "a",
      tipo: "lista",
      estilo: "marcadores",
      itens: ["Linha um", "Linha dois"],
    });
    const titulo = converterBloco(b, alvoDoAtalho("2")!);
    expect(titulo).toMatchObject({
      id: "a",
      tipo: "titulo",
      nivel: 2,
      texto: "Linha um Linha dois",
    });
    const toggle = converterBloco(b, alvoDoAtalho("7")!);
    expect(toggle).toMatchObject({ tipo: "toggle", titulo: "Linha um", texto: "Linha dois" });
    // e de volta para texto
    expect(converterBloco(lista, alvoDoAtalho("0")!)).toMatchObject({
      tipo: "texto",
      texto: "Linha um\nLinha dois",
    });
  });

  it("tipo visual nasce em branco com o mesmo id", () => {
    const r = converterBloco(texto("a", "x"), { tipo: "fluxo", rotulo: "", glifo: "" });
    expect(r).toEqual(blocoEmBranco("fluxo", "a"));
  });

  it("propriedades: tamanho e alinhamento do título, largura da imagem", () => {
    const titulo = blocoEmBranco("titulo", "t");
    expect(propriedadesDoBloco(titulo).map((p) => p.campo)).toEqual(["nivel", "alinhamento"]);
    expect(aplicarPropriedade(titulo, "nivel", 3)).toMatchObject({ nivel: 3 });
    expect(propriedadesDoBloco(blocoEmBranco("imagem", "i")).map((p) => p.campo)).toEqual([
      "largura",
      "alinhamento",
    ]);
    expect(propriedadesDoBloco(blocoEmBranco("separador", "s"))).toEqual([]);
  });

  it("mover, duplicar e remover vários", () => {
    const [a, b, c, d] = ["a", "b", "c", "d"].map((x) => texto(x, x)) as [
      Bloco,
      Bloco,
      Bloco,
      Bloco,
    ];
    const lista = [a, b, c, d];
    expect(moverBlocos(lista, new Set(["a", "b"]), "c", true).map((x) => x.id)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
    expect(moverBlocos(lista, new Set(["c", "d"]), "a", false).map((x) => x.id)).toEqual([
      "c",
      "d",
      "a",
      "b",
    ]);
    expect(moverBlocos(lista, new Set(["a"]), "a", true)).toBe(lista);
    let n = 0;
    expect(duplicarBlocos(lista, new Set(["b"]), () => `n${n++}`).map((x) => x.id)).toEqual([
      "a",
      "b",
      "n0",
      "c",
      "d",
    ]);
    expect(removerBlocos(lista, new Set(["a", "d"])).map((x) => x.id)).toEqual(["b", "c"]);
  });
});
