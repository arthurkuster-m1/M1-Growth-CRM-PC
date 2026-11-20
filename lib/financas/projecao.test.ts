import { describe, expect, it } from "vitest";
import type { Conta, Lancamento } from "./tipos";
import { projetarInicio } from "./projecao";

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
const lan = (x: Partial<Lancamento>): Lancamento => ({
  id: Math.random().toString(),
  data: "2026-11-10",
  valor_cents: 100,
  tipo: "saida",
  status: "pendente",
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

describe("projetarInicio", () => {
  it("encadeia: a fatura de novembro reduz o saldo com que dezembro começa", async () => {
    const contas = [
      conta("cc", "corrente"),
      conta("nu", "cartao", { dia_fechamento: 28, dia_vencimento: 5, conta_pagamento_id: "cc" }),
    ];
    const r = await projetarInicio({
      de: "2026-11",
      ate: "2026-12",
      hoje: "2026-11-15",
      inicioDe: { cc: 1000_00 },
      contas,
      categorias: [],
      carregar: async (mes) =>
        mes === "2026-11"
          ? {
              doMes: [lan({ tipo: "entrada", valor_cents: 500_00, data: "2026-11-25" })],
              daFatura: [lan({ account_id: "nu", valor_cents: 300_00, fatura_mes: "2026-11-01" })],
            }
          : { doMes: [], daFatura: [] },
    });
    expect(r.cc).toBe(1000_00 + 500_00 - 300_00);
  });
  it("mesmo mês: devolve o início como veio", async () => {
    const r = await projetarInicio({
      de: "2026-11",
      ate: "2026-11",
      hoje: "2026-11-15",
      inicioDe: { cc: 5 },
      contas: [],
      categorias: [],
      carregar: async () => ({ doMes: [], daFatura: [] }),
    });
    expect(r).toEqual({ cc: 5 });
  });
});
