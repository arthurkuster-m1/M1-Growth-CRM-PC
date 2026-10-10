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
