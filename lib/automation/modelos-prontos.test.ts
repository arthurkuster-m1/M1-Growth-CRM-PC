import { describe, expect, it } from "vitest";

import { createAutomationRuleSchema } from "@/lib/schemas/webhooks";

import { categoriaDaRegra, categoriaDoFluxo, CATEGORIAS_DE_AUTOMACAO } from "./categorias";
import { MODELOS_DA_CENTRAL } from "./modelos-prontos";

describe("modelos prontos da Central de Automações", () => {
  it.each(MODELOS_DA_CENTRAL.map((m) => [m.id, m] as const))(
    "%s é uma regra válida para a API",
    (_id, m) => {
      const r = createAutomationRuleSchema.safeParse(m.regra);
      expect(r.success, JSON.stringify(r.success ? "" : r.error.issues)).toBe(true);
    },
  );
  it("ids únicos e categorias que existem", () => {
    const ids = MODELOS_DA_CENTRAL.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const validas = new Set<string>(CATEGORIAS_DE_AUTOMACAO.map((c) => c.id));
    for (const m of MODELOS_DA_CENTRAL) expect(validas.has(m.categoria)).toBe(true);
  });
  it("a categoria do modelo bate com a que a regra teria", () => {
    for (const m of MODELOS_DA_CENTRAL) {
      if (m.categoria === "interno") continue;
      expect(categoriaDaRegra(m.regra)).toBe(m.categoria);
    }
  });
});

describe("categorias", () => {
  it("quem avisa outro sistema é Integração", () => {
    expect(
      categoriaDaRegra({ trigger_event: "lead.created", actions: [{ type: "call_webhook" }] }),
    ).toBe("integracoes");
  });
  it("gatilho desconhecido cai em organização interna", () => {
    expect(categoriaDaRegra({ trigger_event: "x.y", actions: [] })).toBe("interno");
  });
  it("fluxo de follow up: no-show e confirmação vão para Agenda, o resto para Follow-up", () => {
    expect(categoriaDoFluxo("Anti No-Show da reunião")).toBe("agenda");
    expect(categoriaDoFluxo("Retomar lead frio")).toBe("followup");
  });
});
