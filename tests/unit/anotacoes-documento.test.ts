import { describe, expect, it } from "vitest";

import {
  ajustarCartoes,
  cartoesDoDocumento,
  lerDocumento,
  MAXIMO_DE_BLOCOS_NA_RAIZ,
  type Documento,
} from "@/lib/anotacoes/documento";

const paragrafo = (id: string): Documento[number] => ({
  id,
  type: "paragraph",
  props: {},
  content: [],
  children: [],
});
const cartao = (pageId: string): Documento[number] => ({
  id: `c-${pageId}`,
  type: "subpagina",
  props: { pageId },
  children: [],
});

describe("anotações — documento do editor", () => {
  it("lê só os blocos com id e type; o formato antigo da Estratégia some em vez de quebrar", () => {
    const lido = lerDocumento([paragrafo("a"), { id: "x", tipo: "texto", texto: "oi" }, 5, null]);
    expect(lido.map((b) => b.id)).toEqual(["a"]);
    expect(lerDocumento("lixo")).toEqual([]);
    expect(lerDocumento(null)).toEqual([]);
  });

  it("corta o que passa do teto de blocos na raiz", () => {
    const muitos = Array.from({ length: MAXIMO_DE_BLOCOS_NA_RAIZ + 10 }, (_, i) =>
      paragrafo(`${i}`),
    );
    expect(lerDocumento(muitos)).toHaveLength(MAXIMO_DE_BLOCOS_NA_RAIZ);
  });

  it("lista as subpáginas citadas na ordem do texto, também dentro de outros blocos", () => {
    const doc: Documento = [
      cartao("p2"),
      { ...paragrafo("t"), children: [cartao("p1")] },
      cartao("p3"),
    ];
    expect(cartoesDoDocumento(doc)).toEqual(["p2", "p1", "p3"]);
  });

  it("ajusta os cartões à árvore: tira o que não é mais filha, o repetido, e acrescenta o que falta", () => {
    const doc: Documento = [cartao("p1"), paragrafo("t"), cartao("p1"), cartao("fora")];
    const ajustado = ajustarCartoes(doc, ["p1", "p2"]);
    expect(cartoesDoDocumento(ajustado)).toEqual(["p1", "p2"]);
    expect(ajustado.some((b) => b.id === "t")).toBe(true);
    // O cartão novo vai para o fim.
    expect(ajustado[ajustado.length - 1]!.type).toBe("subpagina");
  });

  it("sem filhas, não deixa cartão nenhum", () => {
    expect(cartoesDoDocumento(ajustarCartoes([cartao("a")], []))).toEqual([]);
  });
});
