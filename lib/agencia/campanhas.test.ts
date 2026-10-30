import { describe, expect, it } from "vitest";

import { cplDaCampanha, origemDosLeads, prazoDaCampanha, verbaDaCampanha } from "./campanhas";

describe("prazo da campanha", () => {
  it("conta os dias que faltam, e os que passaram", () => {
    expect(prazoDaCampanha({ continuous: false, end_date: "2026-11-10" }, "2026-10-30")).toEqual({
      tipo: "restam",
      dias: 11,
    });
    expect(prazoDaCampanha({ continuous: false, end_date: "2026-10-28" }, "2026-10-30")).toEqual({
      tipo: "encerrou",
      dias: 2,
    });
  });
  it("contínua e sem data não têm prazo a contar", () => {
    expect(prazoDaCampanha({ continuous: true, end_date: null }, "2026-10-30").tipo).toBe(
      "continua",
    );
    expect(prazoDaCampanha({ continuous: false, end_date: null }, "2026-10-30").tipo).toBe(
      "sem_prazo",
    );
  });
});

describe("verba total", () => {
  const base = { start_date: "2026-10-01", end_date: "2026-10-10", continuous: false };
  it("total vale como está; por dia multiplica pela duração", () => {
    expect(verbaDaCampanha({ ...base, budget: 1000, budget_period: "total" }).total).toBe(1000);
    expect(verbaDaCampanha({ ...base, budget: 50, budget_period: "diario" }).total).toBe(500);
  });
  it("contínua com verba por período não tem total, mas guarda o período", () => {
    const v = verbaDaCampanha({ ...base, continuous: true, budget: 3000, budget_period: "mensal" });
    expect(v.total).toBeNull();
    expect(v.periodo).toEqual({ valor: 3000, por: "mensal" });
  });
  it("sem verba, nada", () => {
    expect(verbaDaCampanha({ ...base, budget: null, budget_period: "total" })).toEqual({
      total: null,
      periodo: null,
    });
  });
});

describe("CPL e origem dos leads", () => {
  it("sem lead não há CPL", () => {
    expect(cplDaCampanha(100, 0)).toBeNull();
    expect(cplDaCampanha(100, 4)).toBe(25);
  });
  it("o padrão é o CRM; só 'meta' explícito troca", () => {
    expect(origemDosLeads({})).toBe("crm");
    expect(origemDosLeads(null)).toBe("crm");
    expect(origemDosLeads({ leads_source: "meta" })).toBe("meta");
    expect(origemDosLeads({ leads_source: "qualquer" })).toBe("crm");
  });
});
