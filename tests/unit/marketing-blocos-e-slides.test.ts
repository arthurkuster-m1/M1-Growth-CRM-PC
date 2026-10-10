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

describe("blocos visuais", () => {
  it("aceita pirâmide, fluxo e matriz, e descarta forma inválida", () => {
    const lidos = lerBlocos([
      { id: "a", tipo: "piramide", forma: "funil", itens: [{ titulo: "Topo", texto: "x" }] },
      { id: "b", tipo: "fluxo", itens: [{ titulo: "Passo 1", texto: "" }] },
      {
        id: "c",
        tipo: "matriz",
        estilo: "swot",
        celulas: [
          { titulo: "Forças", texto: "" },
          { titulo: "Fraquezas", texto: "" },
          { titulo: "Oportunidades", texto: "" },
          { titulo: "Ameaças", texto: "" },
        ],
      },
      { id: "d", tipo: "piramide", forma: "cubo", itens: [] },
      {
        id: "e",
        tipo: "matriz",
        estilo: "swot",
        celulas: Array.from({ length: 5 }, () => ({ titulo: "x", texto: "" })),
      },
    ]);
    expect(lidos.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
});

describe("calculadora da meta e tabela", () => {
  it("lê números como a pessoa escreve", async () => {
    const { lerNumero, calcular } = await import("@/lib/marketing/calculadora");
    expect(lerNumero("R$ 1.500,50")).toBe(1500.5);
    expect(lerNumero("8.000")).toBe(8000);
    expect(lerNumero("12%")).toBe(12);
    expect(lerNumero("")).toBeNull();
    const r = calcular({
      meta: "8000",
      ticket: "1500",
      conversao: "10",
      cpl: "25",
      margem: "60",
      retencao: "7",
    });
    expect(r.vendas).toBe(6);
    expect(r.leads).toBe(60);
    expect(r.investimento).toBe(1500);
    expect(r.cac).toBe(250);
    expect(r.ltv).toBe(10500);
    expect(r.ltvSobreCac).toBe(42);
  });

  it("sem os dados, não calcula (nunca inventa)", async () => {
    const { calcular } = await import("@/lib/marketing/calculadora");
    const r = calcular({
      meta: "8000",
      ticket: "",
      conversao: "",
      cpl: "",
      margem: "",
      retencao: "",
    });
    expect(r.vendas).toBeNull();
    expect(r.investimento).toBeNull();
  });

  it("valida os blocos tabela e calculadora", () => {
    const lidos = lerBlocos([
      { id: "t", tipo: "tabela", colunas: ["A", "B"], linhas: [["1", "2"]] },
      { id: "x", tipo: "tabela", colunas: [], linhas: [] },
      {
        id: "c",
        tipo: "calculadora",
        meta: "1",
        ticket: "",
        conversao: "",
        cpl: "",
        margem: "",
        retencao: "",
      },
    ]);
    expect(lidos.map((b) => b.id)).toEqual(["t", "c"]);
  });
});

describe("oferta", () => {
  it("o bloco em branco é válido e o texto para a IA cita a garantia exata", async () => {
    const { blocoEmBranco, blocoSchema } = await import("@/lib/marketing/blocos");
    const { ofertaParaTexto, valorTotalDaOferta, precoEmTexto } =
      await import("@/lib/marketing/oferta");
    const base = blocoEmBranco("oferta", "o1");
    expect(blocoSchema.safeParse(base).success).toBe(true);
    if (base.tipo !== "oferta") throw new Error("tipo");
    const o = {
      ...base,
      nivel: "completa" as const,
      resumo: "Sistema completo.",
      preco: { tipo: "setup-mensal" as const, valor: "R$ 1.500", setup: "R$ 3.500", condicoes: "" },
      entregaveis: [{ nome: "A", descricao: "x", valor: "R$ 3.500" }],
      bonus: [{ nome: "B", descricao: "y", valor: "R$ 1.200" }],
      garantia: "Se não cobrir, trabalhamos de graça.",
      nuncaPrometer: ["Resultado garantido em 7 dias"],
    };
    expect(valorTotalDaOferta(o)).toBe(4700);
    expect(precoEmTexto(o)).toBe("Setup R$ 3.500 + R$ 1.500/mês");
    const texto = ofertaParaTexto("Minha oferta", o);
    expect(texto).toContain('"Se não cobrir, trabalhamos de graça."');
    expect(texto).toContain("NUNCA prometer");
    expect(texto).toContain("Valor total de referência (não é o preço)");
  });
});

describe("oferta vira linha do catálogo", () => {
  it("preço em centavos e código estável; sob consulta vira zero", async () => {
    const { blocoEmBranco } = await import("@/lib/marketing/blocos");
    const { linhaDoCatalogo, precoEmCentavos, codigoDaOferta } =
      await import("@/lib/marketing/oferta");
    const base = blocoEmBranco("oferta", "o1");
    if (base.tipo !== "oferta") throw new Error("tipo");
    const mensal = {
      ...base,
      preco: { tipo: "mensal" as const, valor: "R$ 1.500,50", setup: "", condicoes: "" },
    };
    expect(precoEmCentavos(mensal)).toBe(150050);
    const consulta = {
      ...base,
      preco: { tipo: "sob-consulta" as const, valor: "", setup: "", condicoes: "" },
    };
    expect(precoEmCentavos(consulta)).toBe(0);
    expect(codigoDaOferta("produtos-e-ofertas--oferta-assessoria")).toBe(
      "OFERTA-OFERTA-ASSESSORIA",
    );
    const l = linhaDoCatalogo("produtos-e-ofertas--oferta-assessoria", "Assessoria M1", mensal);
    expect(l.nome).toBe("Assessoria M1");
    expect(l.descricao).toContain("OFERTA: Assessoria M1");
    expect(l.preco_cents).toBe(150050);
  });
});

describe("slides com blocos grandes", () => {
  it("oferta e tabela ficam sozinhas no slide, e o seguinte abre outro", async () => {
    const { blocoEmBranco } = await import("@/lib/marketing/blocos");
    const t: Bloco = { id: "t", tipo: "titulo", nivel: 1, texto: "Oferta" };
    const slides = slidesDaPagina([
      t,
      blocoEmBranco("oferta", "o"),
      { id: "x", tipo: "texto", texto: "depois" },
      blocoEmBranco("tabela", "tb"),
    ]);
    const conteudo = slides.filter((s) => s.tipo === "conteudo");
    expect(conteudo.map((s) => s.blocos.map((b) => b.tipo))).toEqual([
      ["oferta"],
      ["texto"],
      ["tabela"],
    ]);
    expect(conteudo[0]?.titulo).toBe("Oferta");
  });
});
