import { describe, expect, it } from "vitest";

import { derivarTrafego, somarBrutos } from "./metricas-de-trafego";

const base = {
  impressoes: 12_188_750,
  alcance: 4_000_000,
  cliques: 173_968,
  viewsLP: 123_974,
  leads: 32_162,
  vendas: 100,
  investimento: 50_000,
  recebido: 200_000,
};

describe("métricas de tráfego", () => {
  it("deriva as taxas do funil (as do desenho: CTR 1,4%, connect 71,3%, conversão 25,9%)", () => {
    const d = derivarTrafego(base);
    expect(d.ctr).toBeCloseTo(1.43, 1);
    expect(d.connect).toBeCloseTo(71.3, 1);
    expect(d.convLP).toBeCloseTo(25.9, 1);
    expect(d.frequencia).toBeCloseTo(3.05, 1);
    expect(d.convVenda).toBeCloseTo(0.31, 1);
    expect(d.cac).toBe(500);
    expect(d.lucro).toBe(150_000);
    expect(d.roas).toBe(4);
  });

  it("sem base para a conta, devolve null (nunca zero)", () => {
    const d = derivarTrafego({ ...base, leads: 0, vendas: 0, viewsLP: 0 });
    expect(d.cpl).toBeNull();
    expect(d.cac).toBeNull();
    expect(d.convLP).toBeNull();
  });

  it("linha sem mídia própria não inventa custo nem entrega", () => {
    const d = derivarTrafego({ ...base, investimento: 0, impressoes: 0, cliques: 0, viewsLP: 0 }, true);
    expect(d.cpl).toBeNull();
    expect(d.roas).toBeNull();
    expect(d.ctr).toBeNull();
    expect(d.lucro).toBe(200_000);
    expect(d.convVenda).toBeCloseTo(0.31, 1);
  });

  it("o rodapé soma o bruto e as taxas saem da soma, não da média das taxas", () => {
    const a = { ...base, impressoes: 1000, cliques: 10, viewsLP: 5, leads: 1, vendas: 0, investimento: 10, recebido: 0, alcance: 500 };
    const b = { ...base, impressoes: 3000, cliques: 90, viewsLP: 45, leads: 9, vendas: 1, investimento: 90, recebido: 100, alcance: 1500 };
    const t = derivarTrafego(somarBrutos([a, b]));
    expect(t.ctr).toBe(2.5);
    expect(t.cpl).toBe(10);
    expect(t.frequencia).toBe(2);
  });
});
