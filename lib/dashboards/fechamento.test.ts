import { describe, expect, it } from "vitest";

import { resumoDeFechamento } from "./fechamento";

const HOJE = "2026-10-30";

describe("fechamento do período", () => {
  const vendas = [
    { id: "a", valor_cents: 1_000_000 }, // R$ 10.000
    { id: "b", valor_cents: 500_000 },
  ];
  it("separa fechado, recebido, a receber e vencido", () => {
    const r = resumoDeFechamento(
      vendas,
      [
        { lead_id: "a", status: "recebida", amount_cents: 100_000, due_on: "2026-10-01" },
        { lead_id: "a", status: "prevista", amount_cents: 450_000, due_on: "2026-10-20" }, // vencida
        { lead_id: "a", status: "prevista", amount_cents: 450_000, due_on: "2026-12-01" },
        { lead_id: "b", status: "recebida", amount_cents: 500_000, due_on: "2026-10-05" },
        { lead_id: "zzz", status: "recebida", amount_cents: 999_999, due_on: "2026-10-05" }, // de outra venda
      ],
      HOJE,
    );
    expect(r.vendas).toBe(2);
    expect(r.fechado).toBe(15000);
    expect(r.recebido).toBe(6000);
    expect(r.aReceber).toBe(9000);
    expect(r.vencido).toBe(4500);
    expect(r.vendasComVencido).toBe(1);
    expect(r.percentualRecebido).toBe(40);
    expect(r.ticketMedio).toBe(7500);
  });
  it("sem venda não há ticket nem percentual", () => {
    const r = resumoDeFechamento([], [], HOJE);
    expect(r.ticketMedio).toBeNull();
    expect(r.percentualRecebido).toBeNull();
  });
});
