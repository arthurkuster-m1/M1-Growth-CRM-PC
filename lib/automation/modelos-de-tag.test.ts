import { describe, expect, it } from "vitest";

import { createAutomationRuleSchema } from "@/lib/schemas/webhooks";

import { MODELOS_DE_TAG } from "./modelos-de-tag";

describe("os modelos prontos de tag", () => {
  it.each(MODELOS_DE_TAG.map((m) => [m.id, m] as const))(
    "%s é uma regra que a API aceitaria como está",
    (_id, modelo) => {
      const r = createAutomationRuleSchema.safeParse(modelo.regra);
      expect(r.success, JSON.stringify(r.success ? "" : r.error.issues)).toBe(true);
    },
  );

  it("cada modelo põe uma tag e tem id único", () => {
    expect(new Set(MODELOS_DE_TAG.map((m) => m.id)).size).toBe(MODELOS_DE_TAG.length);
    for (const m of MODELOS_DE_TAG) {
      expect(m.regra.actions.some((a) => a.type === "add_tag")).toBe(true);
    }
  });
});
