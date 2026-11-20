import { describe, expect, it } from "vitest";
import type { Conta, Lancamento } from "./tipos";
import { faturasDosCartoes, faturasEmAberto, situacaoDaFatura } from "./faturas";

const cartao = {
  id: "k",
  nome: "Mercado Pago",
  tipo: "cartao",
  ativa: true,
  dia_fechamento: 28,
  dia_vencimento: 5,
  conta_pagamento_id: "cc",
} as Conta;
const l = (id: string, o: Partial<Lancamento>) =>
  ({
    id,
    data: "2026-10-10",
    valor_cents: 100,
    tipo: "saida",
    status: "pago",
    nota: null,
    category_id: "c",
    account_id: "k",
    account_destino_id: null,
    fatura_mes: "2026-12-01",
    ...o,
  }) as Lancamento;

describe("faturasDosCartoes", () => {
  const base = [
    l("1", { valor_cents: 30000 }),
    l("2", { valor_cents: 5000, tipo: "entrada" }),
    l("3", { valor_cents: 9000, status: "pendente" }),
    l("4", { valor_cents: 99, status: "cancelado" }),
  ];
  it("total = compras pagas − estornos; previsto à parte; cancelado fora", () => {
    const [f] = faturasDosCartoes({ cartoes: [cartao], lancamentos: base, hoje: "2026-11-04" });
    expect(f).toMatchObject({
      mes: "2026-12",
      total: 25000,
      previsto: 9000,
      jaPaga: 0,
      restante: 25000,
      paga: "2026-12-05",
      vencida: false,
    });
  });
  it("pagamento = transferência PARA o cartão com data no mês da fatura", () => {
    const pag = l("p", {
      tipo: "transferencia",
      account_id: "cc",
      account_destino_id: "k",
      fatura_mes: null,
      data: "2026-12-04",
      valor_cents: 10000,
    });
    const f = faturasDosCartoes({
      cartoes: [cartao],
      lancamentos: [...base, pag],
      hoje: "2026-11-04",
    }).find((x) => x.mes === "2026-12")!;
    expect(f).toMatchObject({ jaPaga: 10000, restante: 15000 });
  });
  it("quitada some das abertas; vencida é marcada", () => {
    const pag = l("p", {
      tipo: "transferencia",
      account_id: "cc",
      account_destino_id: "k",
      fatura_mes: null,
      data: "2026-12-04",
      valor_cents: 25000,
    });
    expect(
      faturasEmAberto(
        faturasDosCartoes({ cartoes: [cartao], lancamentos: [...base, pag], hoje: "2026-11-04" }),
      ),
    ).toHaveLength(0);
    expect(
      faturasEmAberto(
        faturasDosCartoes({ cartoes: [cartao], lancamentos: base, hoje: "2026-12-10" }),
      )[0]!.vencida,
    ).toBe(true);
  });
  it("ordena por mês e ignora outros cartões", () => {
    const r = faturasDosCartoes({
      cartoes: [cartao],
      lancamentos: [
        l("a", { fatura_mes: "2027-01-01" }),
        l("b", { fatura_mes: "2026-11-01" }),
        l("c", { account_id: "outro" }),
      ],
      hoje: "2026-11-04",
    });
    expect(r.map((f) => f.mes)).toEqual(["2026-11", "2027-01"]);
  });
});

describe("situacaoDaFatura", () => {
  const brl = (c: number) => `R$ ${c / 100}`,
    dc = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
  const compra = l("1", { valor_cents: 25000 });
  const pag = (st: "pago" | "pendente", v = 25000) =>
    l("p", {
      tipo: "transferencia",
      account_id: "cc",
      account_destino_id: "k",
      fatura_mes: null,
      data: "2026-12-05",
      valor_cents: v,
      status: st,
    });
  const sit = (ls: Lancamento[], hoje = "2026-11-04") =>
    situacaoDaFatura(
      faturasDosCartoes({ cartoes: [cartao], lancamentos: ls, hoje }).find(
        (f) => f.mes === "2026-12",
      ),
      brl,
      dc,
    );
  it("sem compras", () => expect(sit([]).tipo).toBe("sem_compras"));
  it("aberta, vencida, paga e com pagamento previsto", () => {
    expect(sit([compra])).toMatchObject({ tipo: "aberta", texto: "Em aberto: falta pagar R$ 250" });
    expect(sit([compra], "2026-12-10").tipo).toBe("vencida");
    expect(sit([compra, pag("pago")])).toMatchObject({ tipo: "paga" });
    expect(sit([compra, pag("pendente")])).toMatchObject({ tipo: "pagamento_previsto" });
    expect(sit([compra, pag("pago", 10000)]).texto).toContain("já pago R$ 100");
  });
});
