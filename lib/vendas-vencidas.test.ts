import { describe, expect, it } from "vitest";

import { textoDoAvisoDeVencidas, vencidoPorEmpresa } from "./vendas-vencidas";

describe("parcelas vencidas por empresa", () => {
  it("soma por empresa e conta as vendas distintas", () => {
    const r = vencidoPorEmpresa([
      { organization_id: "a", lead_id: "1", amount_cents: 100_000 },
      { organization_id: "a", lead_id: "1", amount_cents: 50_000 },
      { organization_id: "a", lead_id: "2", amount_cents: 25_000 },
      { organization_id: "b", lead_id: "3", amount_cents: 10_000 },
    ]);
    expect(r.find((x) => x.organization_id === "a")).toEqual({
      organization_id: "a",
      valor_cents: 175_000,
      vendas: 2,
      parcelas: 3,
    });
    expect(r).toHaveLength(2);
  });
  it("o texto do aviso fala em reais, parcelas e vendas", () => {
    const t = textoDoAvisoDeVencidas({ organization_id: "a", valor_cents: 175_000, vendas: 2, parcelas: 3 });
    expect(t.titulo).toContain("1.750,00");
    expect(t.corpo).toContain("3 parcelas vencidas");
    expect(t.corpo).toContain("2 vendas");
  });
});
