import { describe, expect, it } from "vitest";

import { statusAutomatico } from "@/lib/marketing/status-automatico";

const HOJE = "2026-11-17";
const dia = (day: string, spend = 10) => ({ day, spend, impressions: spend * 100 });
const camp = (
  status: "planejada" | "ativa" | "pausada" | "encerrada",
  fim: string | null = null,
  continuous = false,
) => ({
  status,
  end_date: fim,
  continuous,
});

describe("status automático da campanha", () => {
  it("planejada que começa a receber dados do Meta vira ativa", () => {
    expect(statusAutomatico(camp("planejada"), [dia("2026-11-17")], HOJE)).toBe("ativa");
    expect(statusAutomatico(camp("planejada"), [dia("2026-11-15")], HOJE)).toBe("ativa");
  });

  it("sem dados recentes, planejada continua planejada", () => {
    expect(statusAutomatico(camp("planejada"), [], HOJE)).toBeNull();
    expect(statusAutomatico(camp("planejada"), [dia("2026-11-10")], HOJE)).toBeNull();
    expect(
      statusAutomatico(camp("planejada"), [{ day: "2026-11-17", spend: 0, impressions: 0 }], HOJE),
    ).toBeNull();
  });

  it("passou da data final e o Meta parou: ativa vira encerrada (Finalizada)", () => {
    expect(statusAutomatico(camp("ativa", "2026-11-10"), [dia("2026-11-09")], HOJE)).toBe(
      "encerrada",
    );
    expect(statusAutomatico(camp("ativa", "2026-11-10"), [], HOJE)).toBe("encerrada");
  });

  it("passou da data final mas o Meta ainda entrega: segue ativa", () => {
    expect(statusAutomatico(camp("ativa", "2026-11-10"), [dia("2026-11-16")], HOJE)).toBeNull();
  });

  it("antes do fim, um dia sem gasto não finaliza", () => {
    expect(statusAutomatico(camp("ativa", "2026-11-30"), [dia("2026-11-12")], HOJE)).toBeNull();
  });

  it("campanha contínua nunca é finalizada por data", () => {
    expect(statusAutomatico(camp("ativa", "2026-11-01", true), [], HOJE)).toBeNull();
  });

  it("pausada é decisão humana: nunca muda, mesmo recebendo dados", () => {
    expect(statusAutomatico(camp("pausada"), [dia("2026-11-17")], HOJE)).toBeNull();
    expect(statusAutomatico(camp("pausada", "2026-11-01"), [], HOJE)).toBeNull();
  });

  it("encerrada que volta a receber dados volta a ativa", () => {
    expect(statusAutomatico(camp("encerrada", "2026-11-10"), [dia("2026-11-17")], HOJE)).toBe(
      "ativa",
    );
  });
});
