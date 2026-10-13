import { describe, expect, it } from "vitest";

import { ajustarParcelasAoTotal, type ParcelaDoFormulario } from "./vendas";

const p = (number: number, cents: number, recebida = false): ParcelaDoFormulario => ({
  number,
  due_on: `2026-1${number}-10`,
  amount_cents: cents,
  recebida,
  paid_on: recebida ? "2026-10-13" : null,
});

describe("ajustarParcelasAoTotal", () => {
  it("sem parcelas: uma à vista com o total", () => {
    const r = ajustarParcelasAoTotal([], 150000, "2026-11-01", "2026-10-13");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ amount_cents: 150000, due_on: "2026-11-01", recebida: false });
  });
  it("já somam o total: ficam como estão", () => {
    const base = [p(1, 75000), p(2, 75000)];
    expect(ajustarParcelasAoTotal(base, 150000, "", "2026-10-13")).toEqual(base);
  });
  it("produto novo e nada recebido: refaz com o mesmo número de parcelas", () => {
    const r = ajustarParcelasAoTotal([p(1, 75000), p(2, 75000)], 200000, "", "2026-10-13");
    expect(r.map((x) => x.amount_cents)).toEqual([100000, 100000]);
    expect(r[0]!.due_on).toBe("2026-11-10");
  });
  it("com parcela recebida: a diferença vai para a última aberta", () => {
    const r = ajustarParcelasAoTotal([p(1, 75000, true), p(2, 75000)], 200000, "", "2026-10-13");
    expect(r[0]!.amount_cents).toBe(75000);
    expect(r[0]!.recebida).toBe(true);
    expect(r[1]!.amount_cents).toBe(125000);
  });
  it("tudo recebido e total maior: nasce uma parcela com a diferença", () => {
    const r = ajustarParcelasAoTotal([p(1, 100000, true)], 150000, "", "2026-10-13");
    expect(r).toHaveLength(2);
    expect(r[1]).toMatchObject({ amount_cents: 50000, recebida: false });
  });
  it("total zero: não mexe", () => {
    const base = [p(1, 1000)];
    expect(ajustarParcelasAoTotal(base, 0, "", "2026-10-13")).toEqual(base);
  });
});

import { redistribuirAposEditar } from "./vendas";

describe("redistribuirAposEditar", () => {
  it("R$ 1.000 em 2 parcelas: editar a primeira para 750 deixa a segunda em 250", () => {
    const r = redistribuirAposEditar([p(1, 75000), p(2, 50000)], 0, 100000);
    expect(r.map((x) => x.amount_cents)).toEqual([75000, 25000]);
  });
  it("várias abertas depois: divide a diferença entre elas", () => {
    const r = redistribuirAposEditar([p(1, 50000), p(2, 33333), p(3, 33334)], 0, 100000);
    expect(r.map((x) => x.amount_cents)).toEqual([50000, 25000, 25000]);
  });
  it("não mexe nas já recebidas", () => {
    const r = redistribuirAposEditar([p(1, 30000), p(2, 20000, true), p(3, 50000)], 0, 100000);
    expect(r.map((x) => x.amount_cents)).toEqual([30000, 20000, 50000]);
  });
  it("sem parcela aberta depois: fica como está", () => {
    const base = [p(1, 60000), p(2, 50000, true)];
    expect(redistribuirAposEditar(base, 0, 100000)).toEqual(base);
  });
  it("já soma o total: nada muda", () => {
    const base = [p(1, 40000), p(2, 60000)];
    expect(redistribuirAposEditar(base, 0, 100000)).toEqual(base);
  });
});
