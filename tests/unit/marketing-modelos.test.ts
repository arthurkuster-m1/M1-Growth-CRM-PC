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
