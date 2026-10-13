import { describe, expect, it } from "vitest";

import { diasParaOrcamento, equivalenciasDoOrcamento } from "./orcamento-equivalente";

const por = (r: ReturnType<typeof equivalenciasDoOrcamento>, p: string) =>
  r.find((x) => x.periodo === p)!;

describe("diasParaOrcamento", () => {
  it("campanha com início e fim: os dias dela, contando os dois extremos", () => {
    expect(
      diasParaOrcamento({ start_date: "2026-10-01", end_date: "2026-10-10", continuous: false }),
    ).toEqual({ dias: 10, baseadoNoMes: false });
  });
  it("contínua ou sem datas: o mês (30 dias)", () => {
    expect(diasParaOrcamento({ start_date: null, end_date: null, continuous: true })).toEqual({
      dias: 30,
      baseadoNoMes: true,
    });
  });
});

describe("equivalenciasDoOrcamento", () => {
  it("total digitado: calcula mês, semana e dia pelos dias da campanha", () => {
    const r = equivalenciasDoOrcamento(3000, "total", 30, 0);
    expect(por(r, "total").bruto).toBe(3000);
    expect(por(r, "diario").bruto).toBe(100);
    expect(por(r, "semanal").bruto).toBe(700);
    expect(por(r, "mensal").bruto).toBe(3000);
  });
  it("por dia digitado: total pelos dias da campanha, mês de 30 dias e semana de 7", () => {
    const r = equivalenciasDoOrcamento(100, "diario", 10, 0);
    expect(por(r, "diario").bruto).toBe(100);
    expect(por(r, "total").bruto).toBe(1000);
    expect(por(r, "semanal").bruto).toBe(700);
    expect(por(r, "mensal").bruto).toBe(3000);
  });
  it("mensal digitado numa campanha de 10 dias: o total é a fração do mês", () => {
    const r = equivalenciasDoOrcamento(3000, "mensal", 10, 0);
    expect(por(r, "total").bruto).toBe(1000);
    expect(por(r, "mensal").bruto).toBe(3000);
  });
  it("o líquido tira o imposto de cada medida", () => {
    const r = equivalenciasDoOrcamento(20000, "total", 30, 12.5);
    expect(por(r, "total").liquido).toBeCloseTo(17777.78, 2);
  });
});
