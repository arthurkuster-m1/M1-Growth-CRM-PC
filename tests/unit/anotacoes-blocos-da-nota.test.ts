import { describe, expect, it } from "vitest";

import { blocosDaNota, converterDocumentoAntigo } from "@/lib/anotacoes/blocos-da-nota";
import { textoDoDocumento } from "@/lib/anotacoes/busca";
import { documentoSchema } from "@/lib/anotacoes/documento";
import { blocoSchema } from "@/lib/marketing/blocos";

const texto = (t: string, styles: Record<string, boolean> = {}) => ({
  type: "text",
  text: t,
  styles,
});
const bloco = (
  type: string,
  content: unknown[] = [],
  props: object = {},
  children: unknown[] = [],
) => ({
  id: `${type}-${Math.random()}`,
  type,
  props,
  content,
  children,
});

describe("anotações — conversão das páginas do editor anterior", () => {
  it("parágrafo, título, citação e negrito/itálico viram blocos de Marketing", () => {
    const blocos = converterDocumentoAntigo([
      bloco("heading", [texto("Pauta")], { level: 2 }),
      bloco("paragraph", [
        texto("oi ", {}),
        texto("forte", { bold: true }),
        texto(" e "),
        texto("leve", { italic: true }),
      ]),
      bloco("quote", [texto("Frase")]),
      bloco("paragraph", []),
    ]);
    expect(blocos.map((b) => b.tipo)).toEqual(["titulo", "texto", "citacao"]);
    expect(blocos[0]).toMatchObject({ nivel: 2, texto: "Pauta" });
    expect((blocos[1] as { texto: string }).texto).toBe("oi **forte** e *leve*");
  });

  it("itens de lista seguidos viram UMA lista; trocar o tipo abre outra; filhos entram depois", () => {
    const blocos = converterDocumentoAntigo([
      bloco("bulletListItem", [texto("a")]),
      bloco("bulletListItem", [texto("b")], {}, [bloco("bulletListItem", [texto("b1")])]),
      bloco("numberedListItem", [texto("1")]),
      bloco("checkListItem", [texto("t")], { checked: true }),
    ]);
    expect(blocos).toMatchObject([
      { tipo: "lista", estilo: "marcadores", itens: ["a", "b", "b1"] },
      { tipo: "lista", estilo: "numerada", itens: ["1"] },
      { tipo: "lista", estilo: "check", itens: ["t"] },
    ]);
  });

  it("blocos visuais antigos (fluxo, cartões, métricas, matriz, pirâmide, destaque) têm par novo", () => {
    const blocos = converterDocumentoAntigo([
      bloco("fluxo", [], { dados: JSON.stringify([{ titulo: "A", texto: "x" }]) }),
      bloco("cartoes", [], { dados: JSON.stringify([{ titulo: "C", texto: "y" }]) }),
      bloco("metricas", [], { dados: JSON.stringify([{ titulo: "10", texto: "Leads" }]) }),
      bloco("matriz", [], { dados: JSON.stringify([{ titulo: "F", texto: "" }]), estilo: "swot" }),
      bloco("piramide", [], { dados: JSON.stringify(["Topo", "Base"]) }),
      bloco("destaque", [texto("Atenção")], { tom: "atencao" }),
      bloco("subpagina", [], { pageId: "x" }),
    ]);
    expect(blocos.map((b) => b.tipo)).toEqual([
      "fluxo",
      "cards",
      "metricas",
      "matriz",
      "piramide",
      "destaque",
    ]);
    expect(blocos[2]).toMatchObject({ itens: [{ rotulo: "Leads", valor: "10" }] });
  });

  it("blocosDaNota mantém a ordem numa página mista e descarta bloco novo inválido", () => {
    const lidos = blocosDaNota([
      { id: "n1", tipo: "texto", texto: "novo" },
      bloco("paragraph", [texto("velho")]),
      { id: "n2", tipo: "titulo", nivel: 9, texto: "inválido" },
      { id: "n3", tipo: "canvas", nos: [], ligacoes: [], altura: 360 },
    ]);
    expect(lidos.map((b) => b.tipo)).toEqual(["texto", "texto", "canvas"]);
    expect((lidos[1] as { texto: string }).texto).toBe("velho");
  });

  it("o servidor aceita os dois formatos e recusa bloco novo malformado", () => {
    expect(
      documentoSchema.safeParse([
        { id: "a", tipo: "texto", texto: "oi" },
        { id: "b", type: "paragraph", content: [] },
      ]).success,
    ).toBe(true);
    expect(documentoSchema.safeParse([{ id: "a", tipo: "texto" }]).success).toBe(false);
  });

  it("a busca acha o texto dos blocos de hoje, inclusive de dentro de cartões e do canvas", () => {
    const texto = textoDoDocumento([
      { id: "a", tipo: "titulo", nivel: 1, texto: "Contrato Silva" },
      { id: "b", tipo: "cards", itens: [{ titulo: "Prazo", texto: "30 dias" }] },
      {
        id: "c",
        tipo: "canvas",
        nos: [{ id: "n", x: 0, y: 0, forma: "retangulo", cor: "neutra", texto: "Aprovação" }],
        ligacoes: [],
        altura: 360,
      },
    ]);
    expect(texto).toContain("Contrato Silva");
    expect(texto).toContain("30 dias");
    expect(texto).toContain("Aprovação");
    expect(texto).not.toContain("retangulo");
  });
});

describe("bloco canvas", () => {
  it("valida formas e cores; recusa ligação sem destino e altura fora do limite", () => {
    const base = { id: "c", tipo: "canvas", nos: [], ligacoes: [], altura: 360 };
    expect(blocoSchema.safeParse(base).success).toBe(true);
    expect(
      blocoSchema.safeParse({
        ...base,
        nos: [{ id: "n", x: 1, y: 2, forma: "losango", cor: "verde", texto: "ok" }],
        ligacoes: [{ id: "l", de: "n", para: "m" }],
      }).success,
    ).toBe(true);
    expect(
      blocoSchema.safeParse({
        ...base,
        nos: [{ id: "n", x: 1, y: 2, forma: "estrela", cor: "verde", texto: "" }],
      }).success,
    ).toBe(false);
    expect(blocoSchema.safeParse({ ...base, altura: 5000 }).success).toBe(false);
  });
});
