import { describe, expect, it } from "vitest";
import type { Categoria, Conta, Lancamento } from "./tipos";
import {
  itensDoHistorico,
  listaDeMeses,
  mediaJanela,
  mediaMensal,
  resumoPorMes,
  totaisPorCategoria,
} from "./historico";

let n = 0;
const conta = (id: string, tipo: Conta["tipo"]): Conta => ({
  id,
  nome: id,
  tipo,
  ativa: true,
  ordem: 0,
  rendimento_pct: null,
  rendimento_base: null,
  dia_fechamento: null,
  dia_vencimento: null,
  conta_pagamento_id: null,
});
const cat = (
  id: string,
  tipo: "entrada" | "saida",
  grupo: string | null = null,
  orc = 0,
  anual = 0,
): Categoria => ({
  id,
  nome: id,
  group_id: null,
  grupo,
  cor: null,
  tipo,
  orcamento_mensal_cents: orc,
  orcamento_anual_cents: anual,
  ativa: true,
  ordem: 0,
});
const lan = (x: Partial<Lancamento>): Lancamento => ({
  id: `l${++n}`,
  data: "2026-03-10",
  valor_cents: 100,
  tipo: "saida",
  status: "pago",
  nota: null,
  category_id: null,
  account_id: "cc",
  account_destino_id: null,
  fatura_mes: null,
  parcela_atual: null,
  parcela_total: null,
  created_by: null,
  created_at: "",
  ...x,
});
const contas = [conta("cc", "corrente"), conta("nu", "cartao")];
const categorias = [
  cat("Mercado", "saida", null, 100_00, 0),
  cat("Salário", "entrada"),
  cat("Ajuste", "saida", "Sistema"),
];
const base = { contas, categorias, de: "2026-01", ate: "2026-04" };

describe("histórico", () => {
  it("cartão entra pelo mês da fatura; estorno abate; transferência e Sistema ficam fora", () => {
    const it_ = itensDoHistorico({
      ...base,
      lancamentos: [
        lan({
          account_id: "nu",
          valor_cents: 300_00,
          fatura_mes: "2026-03-01",
          data: "2026-01-20",
          category_id: "Mercado",
        }),
        lan({
          account_id: "nu",
          tipo: "entrada",
          valor_cents: 50_00,
          fatura_mes: "2026-03-01",
          data: "2026-02-01",
          category_id: "Mercado",
        }),
        lan({ tipo: "transferencia", account_destino_id: "nu", valor_cents: 999_00 }),
        lan({ valor_cents: 77_00, category_id: "Ajuste" }),
        lan({ valor_cents: 10_00, status: "cancelado", category_id: "Mercado" }),
      ],
    });
    const r = resumoPorMes(it_, ["2026-01", "2026-02", "2026-03"]);
    expect(r[0]!.saidas.total).toBe(0);
    expect(r[2]!.saidas.pago).toBe(250_00);
    expect(r[2]!.entradas.total).toBe(0);
  });
  it("separa previsto de realizado e ignora o que cai fora do período", () => {
    const it_ = itensDoHistorico({
      ...base,
      lancamentos: [
        lan({ tipo: "entrada", valor_cents: 1000_00, category_id: "Salário" }),
        lan({
          tipo: "entrada",
          valor_cents: 500_00,
          status: "pendente",
          category_id: "Salário",
          data: "2026-03-28",
        }),
        lan({ valor_cents: 1, data: "2027-01-01" }),
      ],
    });
    const mar = resumoPorMes(it_, listaDeMeses("2026-01", "2026-04"))[2]!;
    expect(mar.entradas).toEqual({ pago: 1000_00, previsto: 500_00, total: 1500_00 });
    expect(it_).toHaveLength(2);
  });
  it("mesma linha buscada por duas consultas não conta em dobro", () => {
    const l = lan({ valor_cents: 40_00, category_id: "Mercado" });
    expect(itensDoHistorico({ ...base, lancamentos: [l, l] })).toHaveLength(1);
  });
  it("totais por categoria, ordenados, com orçamento do período", () => {
    const it_ = itensDoHistorico({
      ...base,
      lancamentos: [
        lan({ valor_cents: 40_00, category_id: "Mercado" }),
        lan({ valor_cents: 60_00, category_id: "Mercado", data: "2026-02-02" }),
        lan({ valor_cents: 5_00 }),
      ],
    });
    const t = totaisPorCategoria(it_, "saida", categorias, 3);
    expect(t.map((x) => [x.nome, x.total])).toEqual([
      ["Mercado", 100_00],
      ["Sem categoria", 5_00],
    ]);
    expect(t[0]!.orcamentoAnual).toBe(300_00);
  });
  it("média dos meses fechados com movimento; sem histórico devolve null", () => {
    const it_ = itensDoHistorico({
      ...base,
      lancamentos: [
        lan({ valor_cents: 100_00, data: "2026-01-05" }),
        lan({ valor_cents: 300_00, data: "2026-02-05" }),
        lan({ valor_cents: 999_00, data: "2026-03-05" }),
      ],
    });
    const linhas = resumoPorMes(it_, listaDeMeses("2026-01", "2026-04"));
    expect(mediaMensal(linhas, "2026-03")).toMatchObject({ saidas: 200_00, meses: 2 });
    expect(mediaMensal(linhas, "2026-01")).toBeNull();
  });
});

describe("mediaJanela", () => {
  const L = (mes: string, e: number, sa: number) => ({
    mes,
    entradas: { pago: e, previsto: 0, total: e },
    saidas: { pago: sa, previsto: 0, total: sa },
    resultado: e - sa,
  });
  it("4 meses antes do atual, mês vazio conta zero", () => {
    const r = mediaJanela(
      [
        L("2026-06", 0, 0),
        L("2026-07", 100, 40),
        L("2026-08", 100, 40),
        L("2026-09", 100, 40),
        L("2026-10", 100, 40),
        L("2026-11", 999, 999),
      ],
      "2026-11",
      4,
    );
    expect(r).toMatchObject({
      de: "2026-07",
      ate: "2026-10",
      saidas: 40,
      entradas: 100,
      resultado: 60,
    });
    expect(
      mediaJanela(
        [L("2026-07", 100, 40), L("2026-08", 0, 0), L("2026-09", 0, 0), L("2026-10", 0, 0)],
        "2026-11",
        4,
      ),
    ).toMatchObject({ saidas: 10, entradas: 25 });
  });
  it("sem nenhum movimento → null", () =>
    expect(mediaJanela([L("2026-10", 0, 0)], "2026-11")).toBeNull());
});
