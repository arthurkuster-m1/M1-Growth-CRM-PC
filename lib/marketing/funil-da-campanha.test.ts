import { describe, expect, it } from "vitest";

import { previsaoDeLeads, type DiaDaCampanha } from "./campanhas-resumo";
import { montarCoorte } from "./crm-por-dia";

const dia = (day: string, spend: number, leads: number): DiaDaCampanha => ({
  day,
  impressions: 0,
  reach: 0,
  link_clicks: 0,
  lp_views: 0,
  leads,
  spend,
  extras: {},
  source: "meta",
});

describe("previsaoDeLeads", () => {
  it("soma o que já captou ao que a verba restante compra ao CPL dos 3 últimos dias", () => {
    const dias = [
      dia("2026-10-01", 500, 1),
      dia("2026-10-02", 100, 2),
      dia("2026-10-03", 100, 2),
      dia("2026-10-04", 100, 1),
    ];
    // últimos 3 dias: gasto 300 / 5 leads = CPL 60; restante 600 → +10
    expect(previsaoDeLeads(dias, "2026-10-04", 6, 600, 90)).toBeCloseTo(16);
  });
  it("sem leads nos últimos dias usa o CPL geral; sem CPL nenhum não inventa", () => {
    expect(previsaoDeLeads([dia("2026-10-04", 50, 0)], "2026-10-04", 4, 200, 50)).toBeCloseTo(8);
    expect(previsaoDeLeads([], "2026-10-04", 4, 200, null)).toBeNull();
    expect(previsaoDeLeads([], "2026-10-04", 4, null, 50)).toBeNull();
  });
});

describe("montarCoorte", () => {
  it("o funil nunca desce de uma etapa para a anterior", () => {
    const f = montarCoorte(
      new Map([
        ["a", { agendou: false, fez: false, comprou: true, recebido: 100 }],
        ["b", { agendou: true, fez: false, comprou: false, recebido: 0 }],
        ["c", { agendou: false, fez: false, comprou: false, recebido: 0 }],
      ]),
    );
    expect(f).toEqual({ leads: 3, agendados: 2, feitas: 1, vendas: 1, faturamento: 100 });
    expect(f.agendados).toBeLessThanOrEqual(f.leads);
    expect(f.feitas).toBeLessThanOrEqual(f.agendados);
    expect(f.vendas).toBeLessThanOrEqual(f.feitas);
  });
});

import { leadsForaDoPeriodo, periodoComDados } from "./campanhas-resumo";

describe("leads fora do período da campanha", () => {
  const c = { start_date: "2026-10-19", end_date: "2026-10-29", continuous: false };
  const dias = [dia("2026-10-18", 0, 1), dia("2026-10-20", 100, 2), dia("2026-10-30", 0, 3)];
  it("conta os que entraram antes do início e depois do fim", () => {
    expect(leadsForaDoPeriodo(c, dias)).toEqual({ total: 4, antes: 1, depois: 3 });
    expect(leadsForaDoPeriodo({ ...c, continuous: true }, dias)).toBeNull();
    expect(leadsForaDoPeriodo(c, [dia("2026-10-20", 100, 2)])).toBeNull();
  });
  it("o dia a dia estica até os dias de fora que têm dados", () => {
    expect(periodoComDados({ de: "2026-10-19", ate: "2026-10-29" }, c, dias)).toEqual({
      de: "2026-10-18",
      ate: "2026-10-30",
    });
    expect(
      periodoComDados({ de: "2026-10-19", ate: "2026-10-29" }, c, [dia("2026-10-20", 1, 1)]),
    ).toEqual({ de: "2026-10-19", ate: "2026-10-29" });
  });
});
