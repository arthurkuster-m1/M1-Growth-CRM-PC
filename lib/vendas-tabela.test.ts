import { describe, expect, it } from "vitest";

import { recebeuNoMes, recorteDoMes, resumoDaVenda } from "./vendas-tabela";
import type { Venda } from "./vendas";

const venda = (parcelas: Venda["parcelas"], total = 500000): Venda =>
  ({
    id: "v1",
    name: "",
    product_name: "Assessoria",
    amount_cents: total,
    itens: [{ product_id: "p", product_name: "Assessoria", quantity: 1, amount_cents: total }],
    parcelas,
  }) as unknown as Venda;

const p = (
  number: number,
  status: "prevista" | "recebida" | "cancelada",
  due: string,
  paid: string | null = null,
) => ({ number, due_on: due, paid_on: paid, amount_cents: 100000, status });

describe("resumoDaVenda", () => {
  it("soma pago e previsto, acha primeiro, último e próximo pagamento", () => {
    const r = resumoDaVenda(
      venda([
        p(1, "recebida", "2026-01-10", "2026-01-10"),
        p(2, "recebida", "2026-02-10", "2026-02-12"),
        p(3, "prevista", "2026-03-10"),
        p(4, "prevista", "2026-04-10"),
        p(5, "cancelada", "2026-05-10"),
      ]),
    );
    expect(r.pagoCents).toBe(200000);
    expect(r.previstoCents).toBe(200000);
    expect(r.parcelasPagas).toBe(2);
    expect(r.parcelas).toHaveLength(4);
    expect(r.primeiroPagamento).toBe("2026-01-10");
    expect(r.ultimoPagamento).toBe("2026-02-12");
    expect(r.proximoPagamento).toBe("2026-03-10");
  });

  it("100% paga: próximo pagamento é traço (nulo)", () => {
    const r = resumoDaVenda(venda([p(1, "recebida", "2026-01-10", "2026-01-10")], 100000));
    expect(r.proximoPagamento).toBeNull();
  });
});

describe("recorteDoMes", () => {
  const v = venda([
    p(1, "recebida", "2026-01-10", "2026-01-10"),
    p(2, "recebida", "2026-02-10", "2026-02-10"),
    p(3, "recebida", "2026-05-10", "2026-05-11"),
    p(4, "prevista", "2026-06-10"),
  ]);
  it("mostra só a parcela e o valor pagos no mês", () => {
    const r = recorteDoMes(v, "2026-05");
    expect(r.parcelas).toHaveLength(1);
    expect(r.amount_cents).toBe(100000);
    expect(resumoDaVenda(r).previstoCents).toBe(0);
  });
  it("sabe se a venda recebeu no mês", () => {
    expect(recebeuNoMes(v, "2026-05")).toBe(true);
    expect(recebeuNoMes(v, "2026-04")).toBe(false);
  });
});
