import { describe, expect, it } from "vitest";

import { lerBlocos } from "@/lib/marketing/blocos";
import { modeloDaPagina } from "@/lib/marketing/modelos";
import { lerTextoDaPagina, TEXTO_DE_EXEMPLO, textoDaPagina } from "@/lib/marketing/texto-estruturado";

let k = 0;
const id = () => `b${++k}`;

describe("texto estruturado da página", () => {
  it("o exemplo da tela é lido sem problema e vira os blocos certos", () => {
    const r = lerTextoDaPagina(TEXTO_DE_EXEMPLO, id);
    expect(r.problemas).toEqual([]);
    expect(r.blocos.map((b) => b.tipo)).toEqual([
      "titulo", "texto", "metricas", "titulo", "fluxo", "titulo", "matriz", "destaque", "lista",
    ]);
    const m = r.blocos[2]!;
    expect(m.tipo === "metricas" && m.itens[0]).toEqual({
      rotulo: "Faturamento dos últimos 12 meses", valor: "R$ 480 mil", detalhe: "estável",
    });
    const d = r.blocos[7]!;
    expect(d.tipo === "destaque" && d.tom).toBe("atencao");
  });

  it("lista numerada, checklist e separador", () => {
    const r = lerTextoDaPagina("1. um\n2. dois\n\n[ ] a\n[x] b\n\n---", id);
    expect(r.blocos.map((b) => b.tipo === "lista" ? b.estilo : b.tipo)).toEqual(["numerada", "check", "separador"]);
  });

  it("barra vertical escapada fica no texto", () => {
    const r = lerTextoDaPagina("::: cards\nA | usa a \\| e segue\n:::", id);
    const b = r.blocos[0]!;
    expect(b.tipo === "cards" && b.itens[0]!.texto).toBe("usa a | e segue");
  });

  it("tudo ou nada: um erro impede importar e traz o número da linha", () => {
    const r = lerTextoDaPagina("# Ok\n\n::: matriz swot\nA | b\n:::\n\n::: coisa\nx\n:::\n\n::: fluxo\na | b", id);
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
