import { describe, expect, it } from "vitest";

import { montarDias, periodoAnterior, somarDias_ } from "./trafego";

describe("dashboard de tráfego: contas", () => {
  it("o período anterior tem o mesmo tamanho e termina na véspera", () => {
    expect(periodoAnterior("2026-10-08", "2026-10-14")).toEqual({
      de: "2026-10-01",
      ate: "2026-10-07",
    });
  });

  it("junta Meta, leads do CRM e dinheiro pago; a venda conta no dia da 1ª parcela", () => {
    const dias = montarDias(
      "2026-10-01",
      "2026-10-03",
      [
        { campaign_id: "c1", day: "2026-10-01", impressions: 1000, reach: 800, link_clicks: 20, lp_views: 10, spend: 50 },
        { campaign_id: "c2", day: "2026-10-01", impressions: 500, reach: 400, link_clicks: 5, lp_views: 3, spend: 25.5 },
      ],
      new Map([["2026-10-01", 4], ["2026-10-02", 2]]),
      [
        { sale_id: "v1", campaign_id: "c1", paid_on: "2026-10-02", amount: 300 },
        { sale_id: "v1", campaign_id: "c1", paid_on: "2026-10-03", amount: 300 },
      ],
    );
    expect(dias).toHaveLength(3);
    expect(dias[0]).toMatchObject({ impressoes: 1500, cliques: 25, leads: 4, investimento: 75.5 });
    expect(dias[1]).toMatchObject({ vendas: 1, recebido: 300, leads: 2 });
    expect(dias[2]).toMatchObject({ vendas: 0, recebido: 300 });
    const t = somarDias_(dias);
    expect(t.recebido).toBe(600);
    expect(t.vendas).toBe(1);
  });
});
