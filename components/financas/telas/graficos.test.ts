import { describe, expect, it } from "vitest";
import { faixasDoGrafico } from "./graficos";

describe("faixasDoGrafico", () => {
  it("faixas redondas em centavos (10 mil, 20 mil…) e teto da escala", () => {
    const r = faixasDoGrafico(0, 3_669_000);
    expect(r.ticks).toEqual([0, 1_000_000, 2_000_000, 3_000_000, 4_000_000]);
    expect(r.teto).toBe(4_000_000);
  });
  it("valor pequeno e com negativo", () => {
    expect(faixasDoGrafico(0, 80_000).ticks.every((v) => v % 10_000 === 0)).toBe(true);
    const n = faixasDoGrafico(-500_000, 1_000_000);
    expect(n.ticks).toContain(0);
    expect(n.ticks[0]).toBeLessThanOrEqual(-500_000 + 500_000);
  });
  it("tudo igual não quebra", () => expect(faixasDoGrafico(0, 1).ticks.length).toBeGreaterThan(0));
});
