import { describe, expect, it } from "vitest";

import { caminhoDeIaSuspenso as s } from "./suspensao";

describe("suspensão da área de IA", () => {
  it("suspende as telas de agente", () => {
    for (const c of [
      "/app/ai",
      "/app/ai/agents",
      "/app/ai/agents/123",
      "/app/ai/routers",
      "/app/ai/credentials",
      "/app/ai/knowledge/sources",
      "/app/ai/cases/avisos",
      "/app/ai/usage",
      "/app/ai/atendimento/9",
    ])
      expect(s(c, true)).toBe(true);
  });
  it("mantém a Central de Avisos e os follow-ups", () => {
    expect(s("/app/ai/inbox", true)).toBe(false);
    expect(s("/app/ai/followups", true)).toBe(false);
    expect(s("/app/ai/followups/abc/enrollments", true)).toBe(false);
  });
  it("não mexe no que não é de IA, nem com a suspensão desligada", () => {
    expect(s("/app/aiquer", true)).toBe(false);
    expect(s("/app/automacoes", true)).toBe(false);
    expect(s("/app/ai/agents", false)).toBe(false);
  });
});

import { comGrupoDaSuspensao } from "./suspensao";

describe("grupo das portas mantidas", () => {
  it("com a IA suspensa, Alertas e Follow-ups vão para Atendimento; o resto não muda", () => {
    const alertas = { href: "/app/ai/inbox", group: "ia", section: "Acompanhar o agente" };
    expect(comGrupoDaSuspensao(alertas, true)).toMatchObject({ group: "atendimento" });
    expect(comGrupoDaSuspensao(alertas, false)).toBe(alertas);
    const tarefas = { href: "/app/tarefas", group: "atendimento" };
    expect(comGrupoDaSuspensao(tarefas, true)).toBe(tarefas);
  });
});
