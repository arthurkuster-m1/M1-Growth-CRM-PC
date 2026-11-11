import { describe, expect, it } from "vitest";

import { blocoEmBranco, lerBlocos } from "@/lib/marketing/blocos";
import { modeloDaPagina } from "@/lib/marketing/modelos";
import {
  lerTextoDaPagina,
  TEXTO_DE_EXEMPLO,
  textoDaPagina,
} from "@/lib/marketing/texto-estruturado";

let k = 0;
const id = () => `b${++k}`;

describe("texto estruturado da página", () => {
  it("o exemplo da tela é lido sem problema e vira os blocos certos", () => {
    const r = lerTextoDaPagina(TEXTO_DE_EXEMPLO, id);
    expect(r.problemas).toEqual([]);
    expect(r.blocos.map((b) => b.tipo)).toEqual([
      "titulo",
      "texto",
      "metricas",
      "titulo",
      "fluxo",
      "titulo",
      "matriz",
      "destaque",
      "lista",
    ]);
    const m = r.blocos[2]!;
    expect(m.tipo === "metricas" && m.itens[0]).toEqual({
      rotulo: "Faturamento dos últimos 12 meses",
      valor: "R$ 480 mil",
      detalhe: "estável",
    });
    const d = r.blocos[7]!;
    expect(d.tipo === "destaque" && d.tom).toBe("atencao");
  });

  it("lista numerada, checklist e separador", () => {
    const r = lerTextoDaPagina("1. um\n2. dois\n\n[ ] a\n[x] b\n\n---", id);
    expect(r.blocos.map((b) => (b.tipo === "lista" ? b.estilo : b.tipo))).toEqual([
      "numerada",
      "check",
      "separador",
    ]);
  });

  it("barra vertical escapada fica no texto", () => {
    const r = lerTextoDaPagina("::: cards\nA | usa a \\| e segue\n:::", id);
    const b = r.blocos[0]!;
    expect(b.tipo === "cards" && b.itens[0]!.texto).toBe("usa a | e segue");
  });

  it("tudo ou nada: um erro impede importar e traz o número da linha", () => {
    const r = lerTextoDaPagina(
      "# Ok\n\n::: matriz swot\nA | b\n:::\n\n::: coisa\nx\n:::\n\n::: fluxo\na | b",
      id,
    );
    expect(r.blocos).toEqual([]);
    expect(r.problemas.map((p) => p.linha)).toEqual(expect.arrayContaining([3, 7]));
    expect(r.problemas.some((p) => /não foi fechado/.test(p.erro))).toBe(true);
  });

  it("limite do campo é avisado, não cortado em silêncio", () => {
    const r = lerTextoDaPagina(`::: metricas\nFaturamento | ${"9".repeat(60)}\n:::`, id);
    expect(r.problemas[0]?.erro).toMatch(/limite/);
  });

  it("linha que parece comando mas é texto usa a barra invertida", () => {
    const r = lerTextoDaPagina("\\# não é título", id);
    const b = r.blocos[0]!;
    expect(b.tipo === "texto" && b.texto).toBe("# não é título");
  });

  it("ida e volta: todos os modelos de página voltam iguais (sem contar os ids)", () => {
    const semId = (bs: unknown[]) => bs.map((b) => ({ ...(b as object), id: "x" }));
    for (const chave of ["mapeamento-do-funil"]) {
      const original = lerBlocos(modeloDaPagina(chave)!.montar(id));
      const { texto, ignorados } = textoDaPagina(original);
      expect(ignorados).toBe(0);
      const volta = lerTextoDaPagina(texto, id);
      expect(volta.problemas).toEqual([]);
      expect(semId(volta.blocos)).toEqual(semId(original));
    }
  });
});

describe("todos os blocos saem e voltam em texto", () => {
  const semId = (bs: unknown[]) => bs.map((b) => ({ ...(b as object), id: "x", linha: undefined }));
  const arquivo = "11111111-2222-3333-4444-555555555555.png";

  it("imagem (com arquivo), imagem+texto, antes/depois, paleta, ficha, calculadora e oferta", () => {
    const original = lerBlocos([
      {
        id: "1",
        tipo: "imagem",
        arquivo,
        legenda: "Logo",
        largura: "media",
        alinhamento: "esquerda",
      },
      {
        id: "2",
        tipo: "imagem-texto",
        arquivo,
        titulo: "T",
        texto: "Corpo **forte**",
        lado: "direita",
      },
      {
        id: "3",
        tipo: "antes-depois",
        antes: { titulo: "A", texto: "x" },
        depois: { titulo: "D", texto: "y", imagem: arquivo },
      },
      { id: "4", tipo: "paleta", cores: [{ nome: "Verde", hex: "#366D6F" }] },
      {
        id: "5",
        tipo: "ficha",
        intro: "Quem somos",
        links: [{ rotulo: "Site", url: "https://a.com", destaque: true }],
      },
      {
        id: "6",
        tipo: "calculadora",
        meta: "R$ 8.000",
        ticket: "1.200",
        conversao: "8%",
        cpl: "22",
        margem: "30%",
        retencao: "",
      },
      {
        id: "7",
        tipo: "oferta",
        ...(blocoEmBranco("oferta", "7") as object),
        resumo: "Pacote | completo",
      },
      { id: "8", tipo: "fluxo", itens: [{ titulo: "Passo", texto: "um" }] },
    ]);
    expect(original).toHaveLength(8);
    const { texto, ignorados } = textoDaPagina(original);
    expect(ignorados).toBe(0);
    const volta = lerTextoDaPagina(texto, id);
    expect(volta.problemas).toEqual([]);
    expect(semId(volta.blocos)).toEqual(semId(original));
  });

  it("blocos lado a lado voltam lado a lado (`|||`)", () => {
    const original = lerBlocos([
      {
        id: "1",
        tipo: "imagem",
        arquivo,
        legenda: "",
        largura: "grande",
        alinhamento: "centro",
        linha: "L",
      },
      {
        id: "2",
        tipo: "imagem",
        arquivo,
        legenda: "",
        largura: "grande",
        alinhamento: "centro",
        linha: "L",
      },
      { id: "3", tipo: "separador" },
    ]);
    const { texto } = textoDaPagina(original);
    expect(texto).toContain("|||");
    const volta = lerTextoDaPagina(texto, id).blocos;
    expect(volta).toHaveLength(3);
    expect(volta[0]!.linha).toBeTruthy();
    expect(volta[0]!.linha).toBe(volta[1]!.linha);
    expect(volta[2]!.linha).toBeUndefined();
  });
});

describe("oferta (o produto) em texto", () => {
  const texto = `::: oferta
nivel | completa
etapa | principal
carro-chefe | sim
resumo | Anúncios no Meta e no Google
para quem | Clínicas
inclui | Criativos | Relatório mensal
prazo | 3 meses
tipo de preco | setup + mensal
preco | R$ 1.500,00
setup | R$ 500,00
condicoes | Pix \\| cartão
promessa | Mais pacientes
garantia | 30 dias
nunca prometer | Resultado garantido
entregavel | Criativos | 8 por mês | R$ 800,00
objecao | Está caro | Compare com o custo de não vender
faq | Tem fidelidade? | 3 meses
:::
`;
  const ids = () => {
    let n = 0;
    return () => `o${++n}`;
  };

  it("lê a oferta do texto", () => {
    const r = lerTextoDaPagina(texto, ids());
    expect(r.problemas).toEqual([]);
    expect(r.blocos).toHaveLength(1);
    expect(r.blocos[0]).toMatchObject({
      tipo: "oferta",
      nivel: "completa",
      etapa: "principal",
      carroChefe: true,
      inclui: ["Criativos", "Relatório mensal"],
      preco: {
        tipo: "setup-mensal",
        valor: "R$ 1.500,00",
        setup: "R$ 500,00",
        condicoes: "Pix | cartão",
      },
      entregaveis: [{ nome: "Criativos", descricao: "8 por mês", valor: "R$ 800,00" }],
      objecoes: [{ objecao: "Está caro", resposta: "Compare com o custo de não vender" }],
      faq: [{ pergunta: "Tem fidelidade?", resposta: "3 meses" }],
    });
  });

  it("copiar como texto e colar de novo devolve a mesma oferta (o copiar não sai mais vazio)", () => {
    const lida = lerTextoDaPagina(texto, ids());
    const { texto: copiado, ignorados } = textoDaPagina(lida.blocos);
    expect(copiado.trim()).not.toBe("");
    expect(ignorados).toBe(0);
    const volta = lerTextoDaPagina(copiado, ids());
    expect(volta.problemas).toEqual([]);
    expect(volta.blocos).toEqual(lida.blocos);
  });

  it("campo desconhecido ou valor inválido é erro com a mensagem, e nada é importado", () => {
    const r = lerTextoDaPagina("::: oferta\netapa | vip\npreço2 | 10\n:::\n", ids());
    expect(r.blocos).toEqual([]);
    expect(r.problemas.map((p) => p.erro).join(" ")).toMatch(/etapa.*vip/);
    expect(r.problemas.map((p) => p.erro).join(" ")).toMatch(/campo desconhecido/);
  });

  it("sem tipo de preço: com valor é pagamento único, sem valor é sob consulta", () => {
    const a = lerTextoDaPagina("::: oferta\npreco | 100\n:::\n", ids());
    const b = lerTextoDaPagina("::: oferta\nresumo | x\n:::\n", ids());
    expect(a.blocos[0]).toMatchObject({ preco: { tipo: "unico" } });
    expect(b.blocos[0]).toMatchObject({ preco: { tipo: "sob-consulta" } });
  });
});
