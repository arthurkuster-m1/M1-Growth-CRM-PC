import { describe, expect, it } from "vitest";

import { blocosSchema } from "@/lib/marketing/blocos";
import { modeloDoModulo } from "@/lib/marketing/modelos";
import { MODULOS_DA_ESTRATEGIA } from "@/lib/marketing/modulos";

describe("modelos de página de marketing", () => {
  it("todo módulo tem um modelo válido, com ids únicos", () => {
    for (const m of MODULOS_DA_ESTRATEGIA) {
      let n = 0;
      const blocos = modeloDoModulo(m.chave, () => `b${n++}`);
      expect(blocosSchema.safeParse(blocos).success, m.chave).toBe(true);
      expect(new Set(blocos.map((b) => b.id)).size).toBe(blocos.length);
    }
  });

  it("o diagnóstico tem só as três páginas combinadas", () => {
    expect(
      MODULOS_DA_ESTRATEGIA.filter((m) => m.fase === "diagnostico").map((m) => m.chave),
    ).toEqual(["mapeamento-do-funil", "posicionamento-zmot", "identidade-da-marca"]);
  });
});

describe("subpáginas do estudo de persona", () => {
  it("lê chaves de módulo e de subpágina, e recusa o resto", async () => {
    const { lerChaveDePagina } = await import("@/lib/marketing/modulos");
    expect(lerChaveDePagina("estudo-de-persona")).toEqual({
      modulo: "estudo-de-persona",
      tipo: null,
    });
    expect(lerChaveDePagina("estudo-de-persona--arvore-de-situacoes")?.tipo).toBe(
      "arvore-de-situacoes",
    );
    expect(lerChaveDePagina("estudo-de-persona--persona-ab12cd")?.tipo).toBe("persona");
    expect(lerChaveDePagina("estudo-de-persona--persona")).toBeNull(); // repetível exige id
    expect(lerChaveDePagina("estudo-de-persona--arvore-de-situacoes-ab12cd")).toBeNull();
    expect(lerChaveDePagina("estudo-de-persona--outra")).toBeNull();
    expect(lerChaveDePagina("branding--persona-ab12cd")).toBeNull();
    expect(lerChaveDePagina("--persona-ab12cd")).toBeNull();
  });

  it("cada tipo de subpágina tem um modelo válido", async () => {
    const { tiposDeSubpagina, chaveDeSubpagina } = await import("@/lib/marketing/modulos");
    for (const x of tiposDeSubpagina("estudo-de-persona")) {
      const chave = chaveDeSubpagina(
        "estudo-de-persona",
        x.tipo,
        x.repetivel ? "ab12cd" : undefined,
      );
      let n = 0;
      const blocos = modeloDoModulo(chave, () => `s${n++}`);
      expect(blocos.length, x.tipo).toBeGreaterThan(3);
      expect(blocosSchema.safeParse(blocos).success, x.tipo).toBe(true);
    }
  });
});

describe("subpáginas da análise de concorrência", () => {
  it("cada tipo tem modelo válido e o concorrente começa pela ficha", async () => {
    const { tiposDeSubpagina, chaveDeSubpagina } = await import("@/lib/marketing/modulos");
    for (const x of tiposDeSubpagina("analise-de-concorrencia")) {
      const chave = chaveDeSubpagina(
        "analise-de-concorrencia",
        x.tipo,
        x.repetivel ? "vetdig" : undefined,
      );
      let n = 0;
      const blocos = modeloDoModulo(chave, () => `c${n++}`);
      expect(blocosSchema.safeParse(blocos).success, x.tipo).toBe(true);
      if (x.tipo === "concorrente") expect(blocos[0]?.tipo).toBe("ficha");
    }
  });
});

describe("produtos e ofertas", () => {
  it("o módulo é largo, fica fora da galeria e tem subpágina de oferta", async () => {
    const { modulosDaFase, moduloLargoDaFase, tiposDeSubpagina } =
      await import("@/lib/marketing/modulos");
    expect(moduloLargoDaFase("produto-e-oferta")?.chave).toBe("produtos-e-ofertas");
    expect(modulosDaFase("produto-e-oferta").some((m) => m.chave === "produtos-e-ofertas")).toBe(
      false,
    );
    expect(tiposDeSubpagina("produtos-e-ofertas").map((t) => t.tipo)).toEqual(["oferta"]);
  });
});

describe("estratégias de marketing (Geração de Demanda)", () => {
  it("não há páginas fixas: o módulo só abriga as estratégias criadas sob medida", async () => {
    const { modulosDaFase, moduloPorChave, tiposDeSubpagina, lerChaveDePagina, chaveDeSubpagina } =
      await import("@/lib/marketing/modulos");
    expect(modulosDaFase("geracao-de-demanda")).toHaveLength(0);
    expect(moduloPorChave("estrategia-de-marketing")?.semPagina).toBe(true);
    // As seis páginas padrão antigas deixaram de existir.
    for (const antiga of [
      "trafego-pago",
      "outbound-marketing",
      "programas-de-indicacao",
      "social-media",
      "parcerias-e-influenciadores",
    ]) {
      expect(moduloPorChave(antiga), antiga).toBeUndefined();
    }
    expect(tiposDeSubpagina("estrategia-de-marketing").map((x) => [x.tipo, x.repetivel])).toEqual([
      ["estrategia", true],
    ]);
    const chave = chaveDeSubpagina("estrategia-de-marketing", "estrategia", "ab12cd");
    expect(lerChaveDePagina(chave)).toEqual({
      modulo: "estrategia-de-marketing",
      tipo: "estrategia",
    });
  });

  it("a estratégia nasce com o modelo de estratégia, válido e com ids únicos", async () => {
    const { chaveDeSubpagina } = await import("@/lib/marketing/modulos");
    let n = 0;
    const blocos = modeloDoModulo(
      chaveDeSubpagina("estrategia-de-marketing", "estrategia", "ab12cd"),
      () => `e${n++}`,
    );
    expect(blocos.length).toBeGreaterThan(8);
    expect(blocosSchema.safeParse(blocos).success).toBe(true);
    expect(new Set(blocos.map((b) => b.id)).size).toBe(blocos.length);
  });
});
