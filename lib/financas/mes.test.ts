import { describe, expect, it } from "vitest";
import type { Categoria, Conta, Lancamento } from "./tipos";
import { calcularMes } from "./mes";

let n = 0;
const conta = (id: string, tipo: Conta["tipo"], x: Partial<Conta> = {}): Conta => ({
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
  ...x,
});
const cat = (
  id: string,
  tipo: "entrada" | "saida",
  orc = 0,
  grupo: string | null = null,
  anual = 0,
): Categoria => ({
  id,
  nome: id,
  group_id: null,
  cor: null,
  grupo,
  tipo,
  orcamento_mensal_cents: orc,
  orcamento_anual_cents: anual,
  ativa: true,
  ordem: 0,
});
const lan = (x: Partial<Lancamento>): Lancamento => ({
  id: `l${++n}`,
  data: "2026-11-10",
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

const contas = [
  conta("cc", "corrente"),
  conta("inv", "investida"),
  conta("nu", "cartao", { dia_fechamento: 28, dia_vencimento: 5, conta_pagamento_id: "cc" }),
];
const categorias = [
  cat("Mercado", "saida", 100_00),
  cat("Casa", "saida", 50_00),
  cat("Salário", "entrada"),
  cat("Ajuste", "saida", 0, "Sistema"),
];
const base = {
  mes: "2026-11",
  hoje: "2026-11-15",
  contas,
  categorias,
  inicio: { cc: 1000_00, inv: 5000_00 },
};

describe("calcularMes", () => {
  it("separa pago de previsto e não conta transferência como entrada nem saída", () => {
    const r = calcularMes({
      ...base,
      daFatura: [],
      doMes: [
        lan({ tipo: "entrada", valor_cents: 500_00, category_id: "Salário", data: "2026-11-05" }),
        lan({
          tipo: "entrada",
          valor_cents: 200_00,
          category_id: "Salário",
          data: "2026-11-25",
          status: "pendente",
        }),
        lan({ valor_cents: 40_00, category_id: "Mercado" }),
        lan({ valor_cents: 30_00, category_id: "Casa", data: "2026-11-20", status: "pendente" }),
        lan({ tipo: "transferencia", valor_cents: 300_00, account_destino_id: "inv" }),
        lan({ valor_cents: 99_00, category_id: "Mercado", status: "cancelado" }),
      ],
    });
    expect(r.entradas).toEqual({ pago: 500_00, previsto: 200_00, total: 700_00 });
    expect(r.saidas).toEqual({ pago: 40_00, previsto: 30_00, total: 70_00 });
    expect(r.resultado).toEqual({ realizado: 460_00, previsto: 630_00 });
  });

  it("teto do mês: restante = teto − (pago + previsto); Sistema fica fora", () => {
    const r = calcularMes({
      ...base,
      teto: 500_00,
      daFatura: [],
      doMes: [
        lan({ valor_cents: 40_00, category_id: "Mercado" }),
        lan({ valor_cents: 30_00, category_id: "Casa", status: "pendente" }),
        lan({ valor_cents: 999_00, category_id: "Ajuste" }),
      ],
    });
    expect(r.orcamento).toBe(500_00);
    expect(r.teto).toMatchObject({
      valor: 500_00,
      definido: true,
      pago: 40_00,
      previsto: 30_00,
      reserva: 0,
      usado: 70_00,
      restante: 430_00,
      estourou: false,
    });
    expect(r.restante).toBe(430_00);
    expect(r.categoriasSaida.map((c) => c.nome)).toEqual(["Mercado", "Casa"]);
  });

  it("sem teto definido não há orçamento: o orçamento da categoria não vale", () => {
    const cats = [cat("Mercado", "saida", 100_00), cat("Casa", "saida", 50_00)];
    const r = calcularMes({
      ...base,
      categorias: cats,
      daFatura: [],
      doMes: [lan({ valor_cents: 40_00, category_id: "Mercado" })],
    });
    expect(r.teto).toMatchObject({ valor: 0, definido: false, usado: 40_00 });
    expect(r.alertas.some((a) => a.grupo === "passou" || a.grupo === "proximo")).toBe(false);
  });

  it("teto passado: restante negativo, 'estourou' e alerta do teto (um só)", () => {
    const r = calcularMes({
      ...base,
      teto: 100_00,
      daFatura: [],
      doMes: [lan({ valor_cents: 130_00, category_id: "Mercado" })],
    });
    expect(r.teto).toMatchObject({ restante: -30_00, estourou: true });
    expect(r.alertas.find((a) => a.id === "estouro-teto")).toMatchObject({
      grupo: "passou",
      valor: 30_00,
      base: "mês",
    });
  });

  it("tudo que sai conta no teto (esporádicas e reserva não existem mais)", () => {
    const cats = [
      cat("Mercado", "saida", 0, null, 1200_00),
      cat("IPVA", "saida", 0, null, 1200_00),
    ];
    const r = calcularMes({
      ...base,
      categorias: cats,
      teto: 1000_00,
      daFatura: [],
      doMes: [
        lan({ valor_cents: 90_00, category_id: "Mercado" }),
        lan({ valor_cents: 800_00, category_id: "IPVA" }),
      ],
    });
    expect(r.teto).toMatchObject({ usado: 890_00, reserva: 0, restante: 110_00 });
  });

  it("compra de cartão entra pelo mês da fatura, não pela data; estorno abate", () => {
    const r = calcularMes({
      ...base,
      doMes: [
        lan({
          account_id: "nu",
          valor_cents: 80_00,
          category_id: "Mercado",
          fatura_mes: "2026-12-01",
          data: "2026-11-30",
        }),
      ],
      daFatura: [
        lan({
          account_id: "nu",
          valor_cents: 100_00,
          category_id: "Mercado",
          fatura_mes: "2026-11-01",
          data: "2026-10-20",
        }),
        lan({
          account_id: "nu",
          tipo: "entrada",
          valor_cents: 10_00,
          category_id: "Mercado",
          fatura_mes: "2026-11-01",
          data: "2026-10-22",
        }),
      ],
    });
    expect(r.saidas.total).toBe(90_00);
    expect(r.entradas.total).toBe(0);
    expect(r.faturas[0]!.total).toBe(90_00);
    expect(r.faturas[0]!.paga).toBe("2026-11-05");
  });

  it("fatura aberta sai do caixa na previsão; pagamento já feito não conta duas vezes", () => {
    const daFatura = [
      lan({
        account_id: "nu",
        valor_cents: 300_00,
        category_id: "Mercado",
        fatura_mes: "2026-11-01",
        data: "2026-10-20",
      }),
    ];
    const sem = calcularMes({ ...base, doMes: [], daFatura });
    expect(sem.faturas[0]!.restante).toBe(300_00);
    expect(sem.patrimonio.previsto).toBe(6000_00 - 300_00);
    expect(sem.patrimonio.realizado).toBe(6000_00);
    const parcial = calcularMes({
      ...base,
      daFatura,
      doMes: [
        lan({
          tipo: "transferencia",
          valor_cents: 100_00,
          account_destino_id: "nu",
          data: "2026-11-05",
        }),
      ],
    });
    expect(parcial.faturas[0]).toMatchObject({ jaPaga: 100_00, restante: 200_00 });
    expect(parcial.patrimonio.realizado).toBe(5900_00);
    expect(parcial.patrimonio.previsto).toBe(5700_00);
  });

  it("patrimônio soma todas as contas (cartão fora); transferência entre contas não muda o total", () => {
    const r = calcularMes({
      ...base,
      daFatura: [],
      doMes: [lan({ tipo: "transferencia", valor_cents: 300_00, account_destino_id: "inv" })],
    });
    expect(r.patrimonio).toMatchObject({ inicio: 6000_00, realizado: 6000_00, previsto: 6000_00 });
    expect(r.contas.find((c) => c.conta.id === "cc")!.realizado).toBe(700_00);
    expect(r.contas.find((c) => c.conta.id === "inv")!.realizado).toBe(5300_00);
    expect(r.contas.some((c) => c.conta.id === "nu")).toBe(false);
  });

  it("meta de ganhos: falta = meta − (recebido + previsto); o previsto é dinheiro certo", () => {
    const cats = [
      ...categorias.filter((c) => c.id !== "Salário"),
      cat("Salário", "entrada", 8000_00),
      cat("Extra", "entrada", 2000_00),
    ];
    const r = calcularMes({
      ...base,
      categorias: cats,
      daFatura: [],
      doMes: [
        lan({ tipo: "entrada", valor_cents: 5000_00, category_id: "Salário" }),
        lan({
          tipo: "entrada",
          valor_cents: 1000_00,
          category_id: "Extra",
          status: "pendente",
          data: "2026-11-25",
        }),
      ],
    });
    expect(r.metaEntradas).toBe(10000_00);
    expect(r.entradas).toEqual({ pago: 5000_00, previsto: 1000_00, total: 6000_00 });
    expect(r.faltaGanhar).toBe(4000_00);
    expect(r.categoriasEntrada.find((c) => c.nome === "Salário")!.uso).toBeCloseTo(0.625);
  });

  it("meta batida só com o previsto: falta ganhar zera", () => {
    const cats = [cat("Salário", "entrada", 1000_00)];
    const r = calcularMes({
      ...base,
      categorias: cats,
      daFatura: [],
      doMes: [
        lan({ tipo: "entrada", valor_cents: 600_00, category_id: "Salário" }),
        lan({
          tipo: "entrada",
          valor_cents: 400_00,
          category_id: "Salário",
          status: "pendente",
          data: "2026-11-25",
        }),
      ],
    });
    expect(r.faltaGanhar).toBe(0);
  });

  it("meta batida: falta ganhar não fica negativa", () => {
    const cats = [cat("Salário", "entrada", 1000_00)];
    const r = calcularMes({
      ...base,
      categorias: cats,
      daFatura: [],
      doMes: [lan({ tipo: "entrada", valor_cents: 1500_00, category_id: "Salário" })],
    });
    expect(r.faltaGanhar).toBe(0);
  });

  it("alertas: previsto atrasado, fatura vencida e teto estourado", () => {
    const r = calcularMes({
      ...base,
      hoje: "2026-11-15",
      teto: 100_00,
      doMes: [
        lan({ valor_cents: 10_00, status: "pendente", data: "2026-11-02", category_id: "Casa" }),
        lan({ valor_cents: 120_00, category_id: "Mercado" }),
      ],
      daFatura: [
        lan({ account_id: "nu", valor_cents: 50_00, fatura_mes: "2026-11-01", data: "2026-10-30" }),
      ],
    });
    const ids = r.alertas.map((a) => a.id);
    expect(ids).toContain("atrasados");
    expect(ids).toContain("falta-pagar-nu");
    expect(r.alertas.find((a) => a.id === "falta-pagar-nu")).toMatchObject({
      grupo: "falta_pagar",
      nome: "nu",
      valor: 50_00,
      vencida: true,
      vence: "2026-11-05",
    });
    expect(ids).toContain("estouro-teto");
  });

  it("não há alerta por categoria nem pelo ano: só o teto do mês avisa gasto", () => {
    const cats = [cat("Mercado", "saida", 0, null, 1000_00)];
    const r = calcularMes({
      ...base,
      categorias: cats,
      daFatura: [],
      anoAcumulado: { Mercado: 950_00 },
      doMes: [lan({ valor_cents: 100_00, category_id: "Mercado" })],
    });
    expect(r.alertas.some((a) => a.base === "ano" || a.nome === "Mercado")).toBe(false);
  });

  it("fatura a pagar vira alerta mesmo antes de vencer (e some quando está paga)", () => {
    const daFatura = [
      lan({ account_id: "nu", valor_cents: 300_00, fatura_mes: "2026-11-01", data: "2026-10-20" }),
    ];
    const aberta = calcularMes({ ...base, hoje: "2026-11-02", daFatura, doMes: [] });
    expect(aberta.alertas.find((a) => a.grupo === "falta_pagar")).toMatchObject({
      nome: "nu",
      valor: 300_00,
      vencida: false,
      vence: "2026-11-05",
    });
    const paga = calcularMes({
      ...base,
      daFatura,
      doMes: [
        lan({
          tipo: "transferencia",
          valor_cents: 300_00,
          account_destino_id: "nu",
          data: "2026-11-05",
        }),
      ],
    });
    expect(paga.alertas.some((a) => a.grupo === "falta_pagar")).toBe(false);
  });

  it("mês futuro: tudo previsto e o patrimônio parte do saldo inicial informado", () => {
    const r = calcularMes({
      ...base,
      mes: "2026-12",
      daFatura: [],
      doMes: [lan({ valor_cents: 10_00, status: "pendente", data: "2026-12-03" })],
    });
    expect(r.patrimonio.realizado).toBe(6000_00);
    expect(r.patrimonio.previsto).toBe(6000_00 - 10_00);
  });
});
