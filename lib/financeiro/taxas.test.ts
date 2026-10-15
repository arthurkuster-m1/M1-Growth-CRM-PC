import { describe, expect, it } from "vitest";

import { bpsPara, chaveDaFormaNova, SEM_TAXA, taxaDoRecebimento, type TaxaDaForma } from "./taxas";

const credito: TaxaDaForma = {
  ...SEM_TAXA("cartao_credito"),
  payer: "company",
  percent_bps: 299,
  installment_bps: { "1": 299, "2": 449, "6": 699 },
};

describe("taxas das formas de pagamento", () => {
  it("usa a taxa da faixa de parcelas, ou a maior faixa abaixo dela", () => {
    expect(bpsPara(credito, 1)).toBe(299);
    expect(bpsPara(credito, 2)).toBe(449);
    expect(bpsPara(credito, 4)).toBe(449);
    expect(bpsPara(credito, 10)).toBe(699);
  });

  it("taxa paga pela empresa vira custo e reduz o líquido", () => {
    const r = taxaDoRecebimento(credito, 100_000, 2);
    expect(r.taxa_cents).toBe(4490);
    expect(r.custo_cents).toBe(4490);
    expect(r.liquido_cents).toBe(95_510);
  });

  it("taxa paga pelo cliente final não é custo da empresa", () => {
    const r = taxaDoRecebimento({ ...credito, payer: "client" }, 100_000, 2);
    expect(r.taxa_cents).toBe(4490);
    expect(r.custo_cents).toBe(0);
    expect(r.liquido_cents).toBe(100_000);
  });

  it("soma a taxa fixa e cria a chave da forma nova", () => {
    const pix = { ...SEM_TAXA("pix"), fixed_cents: 99 };
    expect(taxaDoRecebimento(pix, 10_000, 1).custo_cents).toBe(99);
    expect(chaveDaFormaNova("Link do Stripe")).toBe("outra:link-do-stripe");
  });
});
