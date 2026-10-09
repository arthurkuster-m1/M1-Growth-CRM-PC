import { describe, expect, it } from "vitest";

import {
  diasDaGradeDoMes,
  diferencaEmDias,
  inicioDoMes,
  somarMeses,
  trocarODia,
} from "@/lib/motor/calendario";

describe("calendário do motor", () => {
  it("a grade de outubro de 2026 vai de segunda a domingo, em semanas inteiras", () => {
    const g = diasDaGradeDoMes("2026-10-08");
    expect(g[0]).toBe("2026-09-28");
    expect(g.at(-1)).toBe("2026-11-01");
    expect(g.length % 7).toBe(0);
  });

  it("soma meses atravessando o ano", () => {
    expect(somarMeses("2026-12-01", 1)).toBe("2027-01-01");
    expect(somarMeses("2026-01-01", -1)).toBe("2025-12-01");
    expect(inicioDoMes("2026-10-31")).toBe("2026-10-01");
  });

  it("diferença em dias", () => {
    expect(diferencaEmDias("2026-10-01", "2026-10-08")).toBe(7);
    expect(diferencaEmDias("2026-10-08", "2026-10-01")).toBe(-7);
  });

  it("trocarODia muda o dia e mantém a hora de parede do fuso", () => {
    // 14:00 em São Paulo (UTC-3) = 17:00Z
    expect(trocarODia("2026-10-08T17:00:00.000Z", "2026-10-12", "America/Sao_Paulo")).toBe(
      "2026-10-12T17:00:00.000Z",
    );
    // sem instante de partida: começo do dia no fuso (00:00 = 03:00Z)
    expect(trocarODia(null, "2026-10-12", "America/Sao_Paulo")).toBe("2026-10-12T03:00:00.000Z");
  });
});
