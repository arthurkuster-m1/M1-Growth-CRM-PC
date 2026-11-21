import { describe, expect, it } from "vitest";

import { classificarEvento, interpretarAtividade, valorDaCobranca } from "./cobrancas-interpretar";

describe("classificarEvento", () => {
  it("reconhece cobrança, estorno e recusa", () => {
    expect(classificarEvento("ad_account_billing_charge")).toBe("paga");
    expect(classificarEvento("ad_account_billing_chargeback")).toBe("estornada");
    expect(classificarEvento("ad_account_billing_refund")).toBe("estornada");
    expect(classificarEvento("ad_account_billing_charge_failed")).toBe("recusada");
    expect(classificarEvento("ad_account_billing_decline")).toBe("recusada");
  });
  it("recusa por padrão amplo (erra para o lado de avisar), mas nunca inventa cobrança paga", () => {
    expect(classificarEvento("ad_account_payment_failed")).toBe("recusada");
    expect(classificarEvento("ad_account_billing_charge_something_new")).toBeNull();
    expect(classificarEvento("ad_account_update_spend_limit")).toBeNull();
    expect(classificarEvento("create_campaign")).toBeNull();
    expect(classificarEvento("")).toBeNull();
  });
});

describe("valorDaCobranca", () => {
  it("lê número ou texto numérico, sempre positivo e inteiro", () => {
    expect(valorDaCobranca({ new_value: 12345 })).toBe(12345);
    expect(valorDaCobranca({ amount: "9990" })).toBe(9990);
    expect(valorDaCobranca({ value: -500 })).toBe(500);
    expect(valorDaCobranca({ new_value: 100.4 })).toBe(100);
  });
  it("sem valor legível → null", () => {
    expect(valorDaCobranca({})).toBeNull();
    expect(valorDaCobranca({ new_value: "abc" })).toBeNull();
  });
});

describe("interpretarAtividade", () => {
  const base = {
    event_type: "ad_account_billing_charge",
    event_time: "2026-11-10T15:00:00+0000",
    object_id: "123",
  };

  it("cobrança com extra_data em texto JSON", () => {
    const c = interpretarAtividade(
      {
        ...base,
        extra_data: JSON.stringify({ currency: "BRL", new_value: 25000, transaction_id: "T-9" }),
      },
      "act_1",
    );
    expect(c).toMatchObject({
      metaId: "T-9",
      cobradaEm: "2026-11-10T15:00:00.000Z",
      valorCents: 25000,
      moeda: "BRL",
      estado: "paga",
    });
  });

  it("sem id da plataforma, monta uma chave estável do próprio evento", () => {
    const a = interpretarAtividade({ ...base, extra_data: { new_value: 100 } }, "act_1");
    const b = interpretarAtividade({ ...base, extra_data: { new_value: 100 } }, "act_1");
    expect(a?.metaId).toBe(b?.metaId);
    expect(a?.metaId).toContain("act_1:ad_account_billing_charge:");
  });

  it("moeda ausente usa a da conta; moeda inválida também", () => {
    expect(interpretarAtividade({ ...base, extra_data: {} }, "act_1", "usd")?.moeda).toBe("USD");
    expect(interpretarAtividade({ ...base, extra_data: { currency: "R$" } }, "act_1")?.moeda).toBe(
      "BRL",
    );
  });

  it("valor ausente: guarda a cobrança sem valor", () => {
    expect(
      interpretarAtividade({ ...base, extra_data: "texto solto" }, "act_1")?.valorCents,
    ).toBeNull();
  });

  it("ignora o que não é cobrança e o que não tem data válida", () => {
    expect(interpretarAtividade({ ...base, event_type: "create_ad" }, "act_1")).toBeNull();
    expect(interpretarAtividade({ ...base, event_time: "ontem" }, "act_1")).toBeNull();
    expect(interpretarAtividade({ event_type: base.event_type }, "act_1")).toBeNull();
  });

  it("corta o evento cru quando é grande", () => {
    const c = interpretarAtividade(
      { ...base, extra_data: { new_value: 1, lixo: "x".repeat(5000) } },
      "act_1",
    );
    expect(JSON.stringify(c?.bruto).length).toBeLessThan(6000);
    expect(c?.bruto.event_type).toBe("ad_account_billing_charge");
  });
});
