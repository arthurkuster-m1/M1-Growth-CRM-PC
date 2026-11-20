import { describe, expect, it } from "vitest";
import type { Conta, Lancamento } from "./tipos";
import { FORM_MASSA_VAZIO, dataNoMes, mesQueCai, patchDaEdicaoEmMassa } from "./mesDoLancamento";

const cc = { id: "cc", tipo: "corrente", dia_fechamento: null, dia_vencimento: null } as Conta;
const cartao = { id: "cart", tipo: "cartao", dia_fechamento: 28, dia_vencimento: 5 } as Conta;
const l = (o: Partial<Lancamento> = {}) =>
  ({
    id: "1",
    data: "2026-11-10",
    valor_cents: 100,
    tipo: "saida",
    status: "pago",
    nota: null,
    category_id: "c1",
    account_id: "cc",
    account_destino_id: null,
    fatura_mes: null,
    ...o,
  }) as Lancamento;
const f = (o = {}) => ({ ...FORM_MASSA_VAZIO, ...o });
const HOJE = "2026-11-20";

describe("mesQueCai", () => {
  it("conta comum: mês da data", () =>
    expect(mesQueCai({ data: "2026-11-10", tipo: "saida", conta: cc })).toBe("2026-11"));
  it("cartão: mês da fatura (paga)", () =>
    expect(mesQueCai({ data: "2026-11-10", tipo: "saida", conta: cartao })).toBe("2026-12"));
  it("cartão com fatura escolhida", () =>
    expect(
      mesQueCai({ data: "2026-11-10", tipo: "saida", conta: cartao, faturaMes: "2027-02-01" }),
    ).toBe("2027-02"));
  it("transferência: mês da data", () =>
    expect(mesQueCai({ data: "2026-11-10", tipo: "transferencia", conta: cartao })).toBe(
      "2026-11",
    ));
});
describe("dataNoMes", () => {
  it("mês atual → hoje; outro → dia 1", () => {
    expect(dataNoMes("2026-11", HOJE)).toBe(HOJE);
    expect(dataNoMes("2026-09", HOJE)).toBe("2026-09-01");
  });
});
describe("patchDaEdicaoEmMassa", () => {
  it("nada a mudar → null", () =>
    expect(patchDaEdicaoEmMassa(l(), f(), [cc, cartao], HOJE)).toBeNull());
  it("muda categoria e nota", () =>
    expect(patchDaEdicaoEmMassa(l(), f({ categoriaId: "c2", nota: " x " }), [cc], HOJE)).toEqual({
      category_id: "c2",
      nota: "x",
    }));
  it("transferência ignora categoria", () =>
    expect(
      patchDaEdicaoEmMassa(
        l({ tipo: "transferencia", category_id: null }),
        f({ categoriaId: "c2" }),
        [cc],
        HOJE,
      ),
    ).toBeNull());
  it("pago com data futura vira hoje", () =>
    expect(
      patchDaEdicaoEmMassa(
        l({ status: "pendente", data: "2026-12-01" }),
        f({ status: "pago" }),
        [cc],
        HOJE,
      ),
    ).toEqual({ status: "pago", data: HOJE }));
  it("trocar para cartão recalcula a fatura; voltar para conta limpa", () => {
    expect(patchDaEdicaoEmMassa(l(), f({ contaId: "cart" }), [cc, cartao], HOJE)).toEqual({
      account_id: "cart",
      fatura_mes: "2026-12-01",
    });
    expect(
      patchDaEdicaoEmMassa(
        l({ account_id: "cart", fatura_mes: "2026-12-01" }),
        f({ contaId: "cc" }),
        [cc, cartao],
        HOJE,
      ),
    ).toEqual({ account_id: "cc", fatura_mes: null });
  });
  it("fatura escolhida; mudar a data no cartão recalcula", () => {
    expect(
      patchDaEdicaoEmMassa(
        l({ account_id: "cart", fatura_mes: "2026-12-01" }),
        f({ faturaMes: "2027-01" }),
        [cartao],
        HOJE,
      ),
    ).toEqual({ fatura_mes: "2027-01-01" });
    expect(
      patchDaEdicaoEmMassa(
        l({ account_id: "cart", fatura_mes: "2027-01-01" }),
        f({ data: "2026-10-15" }),
        [cartao],
        HOJE,
      ),
    ).toEqual({ data: "2026-10-15", fatura_mes: "2026-11-01" });
  });
  it("limpar anotação", () =>
    expect(patchDaEdicaoEmMassa(l({ nota: "a" }), f({ limparNota: true }), [cc], HOJE)).toEqual({
      nota: null,
    }));
});
