import { describe, expect, it } from "vitest";

import { autoavaliacaoSchema, topicosDasAnotacoes } from "./autoavaliacao";

describe("autoavaliação da semana", () => {
  it("transforma as linhas em tópicos, sem marcador solto nem linha vazia", () => {
    expect(topicosDasAnotacoes("- bom ritmo\n\n• travou no briefing\n  * rever pauta ")).toEqual([
      "bom ritmo",
      "travou no briefing",
      "rever pauta",
    ]);
  });
  it("a nota vai de 0 a 100, inteira", () => {
    const base = { semana_inicio: "2026-10-25", anotacoes: "" };
    expect(autoavaliacaoSchema.safeParse({ ...base, nota: 0 }).success).toBe(true);
    expect(autoavaliacaoSchema.safeParse({ ...base, nota: 100 }).success).toBe(true);
    expect(autoavaliacaoSchema.safeParse({ ...base, nota: 101 }).success).toBe(false);
    expect(autoavaliacaoSchema.safeParse({ ...base, nota: 50.5 }).success).toBe(false);
  });
});
