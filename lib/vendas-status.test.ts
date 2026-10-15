import { describe, expect, it } from "vitest";

import { fluxoDoMes, statusDaOportunidade, totaisDeVendas, type Venda } from "./vendas";

const rec = (n: number) => ({ status: "recebida", number: n });
const prev = (n: number) => ({ status: "prevista", number: n });

describe("statusDaOportunidade", () => {
  it("assinatura já paga e em andamento é recorrência ativa", () => {
    expect(
      statusDaOportunidade("won", [rec(1), prev(2)], { is_recurring: true, recurrence_active: true }),
    ).toBe("recorrencia_ativa");
  });
  it("assinatura cancelada (perdida) com parcelas pagas é recorrência encerrada", () => {
    expect(
      statusDaOportunidade("lost", [rec(1)], { is_recurring: true, recurrence_active: false }),
    ).toBe("recorrencia_encerrada");
  });
  it("assinatura sem nada pago, perdida, é cancelada", () => {
    expect(statusDaOportunidade("lost", [], { is_recurring: true, recurrence_active: false })).toBe(
      "cancelada",
    );
  });
  it("venda comum perdida é cancelada, mesmo com sinal pago", () => {
    expect(statusDaOportunidade("lost", [rec(1)])).toBe("cancelada");
  });
});

describe("o que entrou conta mesmo na venda cancelada", () => {
  const cancelada = {
    status: "cancelada",
    amount_cents: 300000,
    parcelas: [
      { number: 1, due_on: "2026-10-10", paid_on: "2026-10-10", amount_cents: 100000, status: "recebida" },
      { number: 2, due_on: "2026-11-10", paid_on: null, amount_cents: 200000, status: "cancelada" },
    ],
  } as unknown as Venda;

  it("totais somam o sinal e a venda fechada", () => {
    const t = totaisDeVendas([cancelada]);
    expect(t.recebido).toBe(100000);
    expect(t.vendasConcluidas).toBe(1);
    expect(t.comprometido).toBe(0);
  });
  it("o fluxo do mês mantém o recebido", () => {
    expect(fluxoDoMes([cancelada], "2026-10").recebido).toBe(100000);
  });
});
