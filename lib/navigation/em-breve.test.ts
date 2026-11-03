import { describe, expect, it } from "vitest";

import { ehEmBreve } from "./em-breve";

describe("áreas marcadas Em breve", () => {
  it("Automações, Finanças e Agente de IA", () => {
    expect(ehEmBreve("/app/automacoes")).toBe(true);
    expect(ehEmBreve("/app/financas")).toBe(true);
    expect(ehEmBreve("/app/ai")).toBe(true);
  });
  it("o resto não", () => {
    expect(ehEmBreve("/app/inbox")).toBe(false);
    expect(ehEmBreve("/app/ai/inbox")).toBe(false);
    expect(ehEmBreve("/app/tarefas?x=1")).toBe(false);
  });
});
