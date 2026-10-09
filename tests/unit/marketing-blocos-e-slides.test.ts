import { describe, expect, it } from "vitest";

import {
  MAXIMO_DE_BLOCOS,
  TIPOS_DE_BLOCO,
  blocoEmBranco,
  blocoSchema,
  blocosSchema,
  lerBlocos,
  type Bloco,
} from "@/lib/marketing/blocos";
import { BLOCOS_POR_SLIDE, slidesDaPagina } from "@/lib/marketing/slides";

const t = (id: string, nivel: 1 | 2, texto: string): Bloco => ({
  id,
  tipo: "titulo",
  nivel,
  texto,
});
const tx = (id: string, texto = "x"): Bloco => ({ id, tipo: "texto", texto });

describe("blocos", () => {
  it("todo tipo tem um bloco em branco que passa no schema (o editor nunca cria bloco inválido)", () => {
    for (const tipo of TIPOS_DE_BLOCO) {
      const b = blocoEmBranco(tipo, "novo-1");
      // Em branco: alguns campos nascem vazios de propósito (a pessoa vai preencher). O que
      // importa é que a FORMA é válida — texto vazio é aceito; link/hex nascem com valor válido.
      expect(
        blocoSchema.safeParse(b).success,
        `bloco "${tipo}" em branco não passa no schema`,
      ).toBe(true);
    }
  });

  it("recusa link que não é http(s) (nada de javascript:)", () => {
    const ruim = { id: "a", tipo: "links", itens: [{ rotulo: "x", url: "javascript:alert(1)" }] };
    const bom = { id: "a", tipo: "links", itens: [{ rotulo: "x", url: "https://exemplo.com/p" }] };
    expect(blocoSchema.safeParse(ruim).success).toBe(false);
    expect(blocoSchema.safeParse(bom).success).toBe(true);
  });

  it("cor da paleta precisa ser #RRGGBB", () => {
    const mk = (hex: string) => ({ id: "p", tipo: "paleta", cores: [{ nome: "A", hex }] });
    expect(blocoSchema.safeParse(mk("#366D6F")).success).toBe(true);
    expect(blocoSchema.safeParse(mk("red")).success).toBe(false);
    expect(blocoSchema.safeParse(mk("#12345")).success).toBe(false);
  });

  it("tem teto de blocos", () => {
    const muitos = Array.from({ length: MAXIMO_DE_BLOCOS + 1 }, (_, i) => tx(`b${i}`));
    expect(blocosSchema.safeParse(muitos).success).toBe(false);
  });

  it("lerBlocos descarta o inválido e segue com o resto (nunca derruba a tela)", () => {
    const lido = lerBlocos([
      tx("a", "ok"),
      { tipo: "alienigena" },
      null,
      { id: "b", tipo: "texto" },
      tx("c", "fim"),
    ]);
    expect(lido.map((b) => b.id)).toEqual(["a", "c"]);
    expect(lerBlocos("lixo")).toEqual([]);
    expect(lerBlocos(null)).toEqual([]);
  });
});

describe("slidesDaPagina", () => {
  it("sem blocos: só a capa", () => {
    expect(slidesDaPagina([]).map((s) => s.tipo)).toEqual(["capa"]);
  });

  it("cada título de nível 1 abre um slide; o nível 2 fica dentro", () => {
    const slides = slidesDaPagina([
      t("1", 1, "Persona"),
      tx("2"),
      t("3", 2, "Dores"),
      tx("4"),
      t("5", 1, "Concorrência"),
      tx("6"),
    ]);
    expect(slides.map((s) => s.titulo)).toEqual([null, "Persona", "Concorrência"]);
    expect(slides[1]!.blocos.map((b) => b.id)).toEqual(["2", "3", "4"]);
  });

  it("blocos antes do primeiro título formam um slide sem título", () => {
    const slides = slidesDaPagina([tx("a"), t("b", 1, "Depois")]);
    expect(slides.map((s) => s.titulo)).toEqual([null, null, "Depois"]);
    expect(slides[1]!.blocos.map((b) => b.id)).toEqual(["a"]);
  });

  it("slide cheio continua no seguinte (slide não rola)", () => {
    const blocos = [
      t("t", 1, "Longo"),
      ...Array.from({ length: BLOCOS_POR_SLIDE + 2 }, (_, i) => tx(`x${i}`)),
    ];
    const slides = slidesDaPagina(blocos);
    expect(slides).toHaveLength(3);
    expect(slides[1]!.blocos).toHaveLength(BLOCOS_POR_SLIDE);
    expect(slides[2]!.titulo).toBeNull();
    expect(slides[2]!.blocos).toHaveLength(2);
  });

  it("o separador quebra o slide e não aparece", () => {
    const slides = slidesDaPagina([tx("a"), { id: "s", tipo: "separador" }, tx("b")]);
    expect(slides).toHaveLength(3);
    expect(slides.flatMap((s) => s.blocos).some((b) => b.tipo === "separador")).toBe(false);
  });

  it("título sozinho é um slide válido (abertura de seção)", () => {
    const slides = slidesDaPagina([t("1", 1, "Seção"), t("2", 1, "Outra"), tx("3")]);
    expect(slides.map((s) => s.titulo)).toEqual([null, "Seção", "Outra"]);
  });
});

describe("blocos de imagem", () => {
  const arquivo = "0b5f2a3e-6c1d-4f7a-9d2e-123456789abc.png";

  it("aceita imagem só pelo nome do arquivo e recusa caminho ou endereço", () => {
    const ok = lerBlocos([
      { id: "a", tipo: "imagem", arquivo, legenda: "", largura: "grande", alinhamento: "centro" },
      {
        id: "b",
        tipo: "imagem",
        arquivo: "",
        legenda: "",
        largura: "media",
        alinhamento: "esquerda",
      },
    ]);
    expect(ok).toHaveLength(2);

    const ruins = lerBlocos([
      {
        id: "c",
        tipo: "imagem",
        arquivo: `outra-empresa/${arquivo}`,
        legenda: "",
        largura: "grande",
        alinhamento: "centro",
      },
      {
        id: "d",
        tipo: "imagem",
        arquivo: "https://x.com/a.png",
        legenda: "",
        largura: "grande",
        alinhamento: "centro",
      },
      {
        id: "e",
        tipo: "imagem",
        arquivo: "../../a.png",
        legenda: "",
        largura: "grande",
        alinhamento: "centro",
      },
    ]);
    expect(ruins).toHaveLength(0);
  });

  it("imagem com texto e antes/depois com imagem seguem válidos", () => {
    const lidos = lerBlocos([
      { id: "a", tipo: "imagem-texto", arquivo, titulo: "t", texto: "x", lado: "direita" },
      {
        id: "b",
        tipo: "antes-depois",
        antes: { titulo: "", texto: "", imagem: arquivo },
        depois: { titulo: "", texto: "" },
      },
      { id: "c", tipo: "texto", texto: "oi", alinhamento: "centro" },
    ]);
    expect(lidos).toHaveLength(3);
  });
});
