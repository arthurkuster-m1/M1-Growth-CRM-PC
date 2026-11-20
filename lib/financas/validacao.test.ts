import { describe, expect, it } from "vitest";

import {
  MAXIMO_POR_REQUISICAO,
  aberturaSchema,
  configSchema,
  criarLancamentosSchema,
  mudancaDeLancamentoSchema,
  novaCategoriaSchema,
  novaContaSchema,
} from "./validacao";

const UUID = "11111111-1111-4111-8111-111111111111";
const base = {
  data: "2026-11-20",
  valor_cents: 15000,
  tipo: "saida" as const,
  account_id: UUID,
  category_id: UUID,
};

describe("lançamento novo", () => {
  it("aceita um lançamento comum e põe status 'pago' quando não vem", () => {
    const r = criarLancamentosSchema.parse({ lancamentos: [base] });
    expect(r.lancamentos[0]!.status).toBe("pago");
  });

  it("NÃO aceita organização, origem nem autor vindos do corpo (são do servidor)", () => {
    for (const intruso of [
      { organization_id: UUID },
      { origem: "venda" },
      { created_by: UUID },
      { ref_externa: "venda:x" },
    ]) {
      expect(
        criarLancamentosSchema.safeParse({ lancamentos: [{ ...base, ...intruso }] }).success,
      ).toBe(false);
    }
  });

  it("recusa valor zero, negativo ou fracionado", () => {
    for (const v of [0, -1, 10.5]) {
      expect(
        criarLancamentosSchema.safeParse({ lancamentos: [{ ...base, valor_cents: v }] }).success,
      ).toBe(false);
    }
  });

  it("recusa data fora do formato e mês da fatura que não é dia 1", () => {
    expect(
      criarLancamentosSchema.safeParse({ lancamentos: [{ ...base, data: "20/11/2026" }] }).success,
    ).toBe(false);
    expect(
      criarLancamentosSchema.safeParse({ lancamentos: [{ ...base, fatura_mes: "2026-12-15" }] })
        .success,
    ).toBe(false);
    expect(
      criarLancamentosSchema.safeParse({ lancamentos: [{ ...base, fatura_mes: "2026-12-01" }] })
        .success,
    ).toBe(true);
  });

  it("aceita de 1 a 120 de uma vez (compra parcelada) e recusa vazio ou mais", () => {
    expect(criarLancamentosSchema.safeParse({ lancamentos: [] }).success).toBe(false);
    expect(
      criarLancamentosSchema.safeParse({ lancamentos: Array(MAXIMO_POR_REQUISICAO).fill(base) })
        .success,
    ).toBe(true);
    expect(
      criarLancamentosSchema.safeParse({ lancamentos: Array(MAXIMO_POR_REQUISICAO + 1).fill(base) })
        .success,
    ).toBe(false);
  });

  it("parcelas: de 2 a 60, e as duas vêm juntas ou nenhuma é validada aqui (o banco confere o par)", () => {
    expect(
      criarLancamentosSchema.safeParse({
        lancamentos: [{ ...base, parcela_atual: 1, parcela_total: 61 }],
      }).success,
    ).toBe(false);
    expect(
      criarLancamentosSchema.safeParse({
        lancamentos: [{ ...base, parcela_atual: 1, parcela_total: 12 }],
      }).success,
    ).toBe(true);
  });
});

describe("mudança de lançamento", () => {
  it("aceita parcial (pagar) e recusa campo desconhecido", () => {
    expect(mudancaDeLancamentoSchema.parse({ status: "pago" })).toEqual({ status: "pago" });
    expect(mudancaDeLancamentoSchema.safeParse({ origem: "manual" }).success).toBe(false);
    expect(mudancaDeLancamentoSchema.safeParse({ status: "sumido" }).success).toBe(false);
  });
});

describe("contas, categorias, config e abertura", () => {
  it("conta nova exige nome e tipo; dia do cartão de 1 a 31", () => {
    expect(novaContaSchema.safeParse({ nome: "Nubank" }).success).toBe(false);
    expect(
      novaContaSchema.safeParse({
        nome: "Nubank",
        tipo: "cartao",
        dia_fechamento: 25,
        dia_vencimento: 5,
      }).success,
    ).toBe(true);
    expect(
      novaContaSchema.safeParse({ nome: "Nubank", tipo: "cartao", dia_fechamento: 32 }).success,
    ).toBe(false);
    expect(
      novaContaSchema.safeParse({ nome: "X", tipo: "cartao", organization_id: UUID }).success,
    ).toBe(false);
  });

  it("categoria nova exige nome e tipo; cor de 1 a 10", () => {
    expect(novaCategoriaSchema.safeParse({ nome: "Vendas", tipo: "entrada", cor: 6 }).success).toBe(
      true,
    );
    expect(
      novaCategoriaSchema.safeParse({ nome: "Vendas", tipo: "entrada", cor: 11 }).success,
    ).toBe(false);
    expect(novaCategoriaSchema.safeParse({ tipo: "entrada" }).success).toBe(false);
  });

  it("config: padrão, exceção de um mês e remoção (valor nulo)", () => {
    expect(configSchema.safeParse({ teto_padrao_cents: 2000000 }).success).toBe(true);
    expect(
      configSchema.safeParse({ teto_do_mes: { mes: "2026-12", valor_cents: null } }).success,
    ).toBe(true);
    expect(
      configSchema.safeParse({ teto_do_mes: { mes: "2026-12-01", valor_cents: 1 } }).success,
    ).toBe(false);
    expect(configSchema.safeParse({ teto_padrao_cents: -1 }).success).toBe(false);
  });

  it("abertura: saldo pode ser negativo, nulo remove", () => {
    expect(
      aberturaSchema.safeParse({ conta: UUID, mes: "2026-11", saldo_cents: -5000 }).success,
    ).toBe(true);
    expect(
      aberturaSchema.safeParse({ conta: UUID, mes: "2026-11", saldo_cents: null }).success,
    ).toBe(true);
    expect(aberturaSchema.safeParse({ conta: "x", mes: "2026-11", saldo_cents: 1 }).success).toBe(
      false,
    );
  });
});
