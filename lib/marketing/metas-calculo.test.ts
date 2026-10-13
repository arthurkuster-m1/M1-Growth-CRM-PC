import { describe, expect, it } from "vitest";

import { investimentoBaseDasMetas, metasRelacionadas } from "./metas-calculo";

const base = {
  goal_leads: null,
  goal_cpl: null,
  goal_sales: null,
  goal_revenue: null,
  ticket: null,
  investimento: null,
};

describe("metasRelacionadas", () => {
  it("faturamento ÷ ticket = vendas (arredonda para cima)", () => {
    expect(
      metasRelacionadas({ ...base, goal_revenue: 10000, ticket: 1500 }, "goal_revenue"),
    ).toEqual({
      goal_sales: 7,
    });
  });
  it("vendas × ticket = faturamento", () => {
    expect(metasRelacionadas({ ...base, goal_sales: 7, ticket: 1500 }, "goal_sales")).toEqual({
      goal_revenue: 10500,
    });
  });
  it("mudar o ticket recalcula o faturamento quando há vendas", () => {
    expect(
      metasRelacionadas({ ...base, goal_sales: 10, goal_revenue: 9999, ticket: 2000 }, "ticket"),
    ).toEqual({ goal_revenue: 20000 });
  });
  it("mudar o ticket sem vendas, mas com faturamento, calcula as vendas", () => {
    expect(metasRelacionadas({ ...base, goal_revenue: 9000, ticket: 2000 }, "ticket")).toEqual({
      goal_sales: 5,
    });
  });
  it("investimento ÷ leads = CPL", () => {
    expect(
      metasRelacionadas({ ...base, goal_leads: 1500, investimento: 20000 }, "goal_leads"),
    ).toEqual({ goal_cpl: 13.33 });
  });
  it("investimento ÷ CPL = leads (arredonda para baixo)", () => {
    expect(
      metasRelacionadas({ ...base, goal_cpl: 13.33, investimento: 20000 }, "goal_cpl"),
    ).toEqual({
      goal_leads: 1500,
    });
  });
  it("mudar o investimento recalcula o CPL; sem leads, calcula os leads pelo CPL", () => {
    expect(
      metasRelacionadas({ ...base, goal_leads: 100, investimento: 5000 }, "investimento"),
    ).toEqual({
      goal_cpl: 50,
    });
    expect(
      metasRelacionadas({ ...base, goal_cpl: 25, investimento: 5000 }, "investimento"),
    ).toEqual({
      goal_leads: 200,
    });
  });
  it("sem a outra ponta, não calcula nada", () => {
    expect(metasRelacionadas({ ...base, goal_sales: 7 }, "goal_sales")).toEqual({});
    expect(metasRelacionadas({ ...base, goal_leads: 100 }, "goal_leads")).toEqual({});
  });
});

describe("investimentoBaseDasMetas", () => {
  it("só vale quando orçamento e metas têm o mesmo período", () => {
    expect(investimentoBaseDasMetas(1000, "total", "total")).toBe(1000);
    expect(investimentoBaseDasMetas(1000, "mensal", "mensal")).toBe(1000);
    expect(investimentoBaseDasMetas(1000, "diario", "mensal")).toBeNull();
    expect(investimentoBaseDasMetas(null, "total", "total")).toBeNull();
  });
});
