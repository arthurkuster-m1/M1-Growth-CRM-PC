import { describe, expect, it } from "vitest";
import { gerarParcelas, totalDasParcelas } from "./parcelas";

describe("gerarParcelas", () => {
  it("R$ 1.000 em 5 vira 5 × R$ 200, uma por fatura seguinte", () => {
    const p = gerarParcelas({
      data: "2026-11-01",
      faturaInicial: "2026-12",
      n: 5,
      modo: "total",
      valor_cents: 100000,
    });
    expect(p.map((x) => x.valor_cents)).toEqual([20000, 20000, 20000, 20000, 20000]);
    expect(p.map((x) => x.fatura)).toEqual(["2026-12", "2027-01", "2027-02", "2027-03", "2027-04"]);
    expect(p.map((x) => x.data)).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
      "2027-03-01",
    ]);
    expect(p.map((x) => `${x.numero}/${x.total}`)).toEqual(["1/5", "2/5", "3/5", "4/5", "5/5"]);
  });
  it("centavos que sobram vão para as primeiras e a soma fecha", () => {
    const p = gerarParcelas({
      data: "2026-11-01",
      faturaInicial: "2026-12",
      n: 3,
      modo: "total",
      valor_cents: 10000,
    });
    expect(p.map((x) => x.valor_cents)).toEqual([3334, 3333, 3333]);
    expect(totalDasParcelas(p)).toBe(10000);
  });
  it("no modo valor da parcela, o total é parcela × N", () => {
    const p = gerarParcelas({
      data: "2026-11-01",
      faturaInicial: "2026-12",
      n: 10,
      modo: "parcela",
      valor_cents: 12345,
    });
    expect(p).toHaveLength(10);
    expect(totalDasParcelas(p)).toBe(123450);
    expect(new Set(p.map((x) => x.valor_cents))).toEqual(new Set([12345]));
  });
  it("dia 31 cai no último dia dos meses curtos e volta ao 31 depois", () => {
    const p = gerarParcelas({
      data: "2026-01-31",
      faturaInicial: "2026-02",
      n: 4,
      modo: "total",
      valor_cents: 400,
    });
    expect(p.map((x) => x.data)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("recusa quantidade e valor inválidos", () => {
    expect(
      gerarParcelas({
        data: "2026-11-01",
        faturaInicial: "2026-12",
        n: 0,
        modo: "total",
        valor_cents: 100,
      }),
    ).toEqual([]);
    expect(
      gerarParcelas({
        data: "2026-11-01",
        faturaInicial: "2026-12",
        n: 61,
        modo: "total",
        valor_cents: 100,
      }),
    ).toEqual([]);
    expect(
      gerarParcelas({
        data: "2026-11-01",
        faturaInicial: "2026-12",
        n: 3,
        modo: "total",
        valor_cents: 0,
      }),
    ).toEqual([]);
  });
});
