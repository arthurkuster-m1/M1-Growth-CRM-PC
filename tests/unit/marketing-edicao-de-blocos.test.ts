import { describe, expect, it } from "vitest";

import { blocoEmBranco, type Bloco } from "@/lib/marketing/blocos";
import {
  alvoDoAtalho,
  alvoDoTeclado,
  ATALHOS_DE_BLOCO,
  atalhoDeMarkdown,
  atalhoDoAlvo,
  dividirNoCursor,
  TODOS_OS_ALVOS,
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

describe("todo bloco tem o seu atalho de teclado", () => {
  it("há uma combinação única para cada bloco dos menus", () => {
    expect(ATALHOS_DE_BLOCO.length).toBeGreaterThanOrEqual(TODOS_OS_ALVOS.length);
    const rotulos = TODOS_OS_ALVOS.map((a) => atalhoDoAlvo(a)?.rotulo);
    expect(rotulos.every(Boolean)).toBe(true);
    expect(new Set(rotulos).size).toBe(TODOS_OS_ALVOS.length);
  });

  it("Ctrl+Shift+número = texto; Ctrl+Alt+número = visuais; depois Espaço e suas variações", () => {
    const tecla = (code: string, shift = false, alt = false) =>
      alvoDoTeclado({ code, ctrlKey: true, metaKey: false, shiftKey: shift, altKey: alt });
    expect(tecla("Digit1", true)?.tipo).toBe("titulo");
    expect(tecla("Digit0", true)?.tipo).toBe("texto");
    expect(tecla("Digit1", false, true)?.tipo).toBe("canvas");
    expect(tecla("Digit2", false, true)?.tipo).toBe("cards");
    expect(tecla("Space")?.tipo).toBeDefined();
    expect(tecla("Space", true)?.tipo).toBeDefined();
    expect(tecla("Space", false, true)?.tipo).toBeDefined();
    expect(tecla("Digit1", true, true)?.tipo).toBeDefined();
    // sem Ctrl não é atalho de bloco
    expect(
      alvoDoTeclado({
        code: "Digit1",
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBeUndefined();
    // Ctrl+1 sozinho é do navegador (trocar de aba): não é nosso
    expect(tecla("Digit1")).toBeUndefined();
  });

  it("os blocos que mais se alcançam por teclado cobrem TODOS os tipos (nenhum fica só no mouse)", () => {
    const tipos = new Set(TODOS_OS_ALVOS.map((a) => a.tipo));
    for (const t of ["canvas", "tabela", "matriz", "oferta", "calculadora", "separador", "ficha"]) {
      expect(tipos.has(t as never)).toBe(true);
    }
  });
});

describe("escrever como no Notion", () => {
  it("marcadores no começo do texto viram o bloco certo", () => {
    expect(atalhoDeMarkdown("# ")).toMatchObject({ alvo: { tipo: "titulo", nivel: 1 }, resto: "" });
    expect(atalhoDeMarkdown("## Plano")).toMatchObject({ resto: "Plano" });
    expect(atalhoDeMarkdown("## ")?.alvo).toMatchObject({ tipo: "titulo", nivel: 2 });
    expect(atalhoDeMarkdown("### x")?.alvo).toMatchObject({ tipo: "titulo", nivel: 3 });
    expect(atalhoDeMarkdown("- item")).toMatchObject({
      alvo: { tipo: "lista", estilo: "marcadores" },
      resto: "item",
    });
    expect(atalhoDeMarkdown("12. passo")).toMatchObject({
      alvo: { tipo: "lista", estilo: "numerada" },
      resto: "passo",
    });
    expect(atalhoDeMarkdown("[] tarefa")?.alvo).toMatchObject({ tipo: "lista", estilo: "check" });
    expect(atalhoDeMarkdown("> mais")?.alvo.tipo).toBe("toggle");
    expect(atalhoDeMarkdown("texto normal")).toBeNull();
    expect(atalhoDeMarkdown("#sem espaço")).toBeNull();
  });

  it("Enter no meio divide o texto no cursor", () => {
    expect(dividirNoCursor("abcdef", 2)).toEqual(["ab", "cdef"]);
    expect(dividirNoCursor("abc", 99)).toEqual(["abc", ""]);
    expect(dividirNoCursor("abc", -3)).toEqual(["", "abc"]);
  });
});
