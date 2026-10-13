import { describe, expect, it } from "vitest";

import {
  CONTAGEM_VAZIA,
  chavesAutomaticas,
  diaNoFuso,
  extrasDoDia,
  investimentoDoDia,
} from "./dia-a-dia-automatico";

describe("extrasDoDia", () => {
  it("prospecção: cada coluna sai do que o sistema sabe", () => {
    const e = extrasDoDia("prospeccao", {
      ...CONTAGEM_VAZIA,
      leads: 4,
      abordagens: 12,
      reunioesAgendadas: 2,
      vendas: 1,
      valorTotal: 1500,
    });
    expect(e).toEqual({
      abordagens: 12,
      contatos: 4,
      reunioes_agendadas: 2,
      reunioes_feitas: 0,
      vendas: 1,
      valor_total: 1500,
    });
  });
  it("tráfego pago não tem coluna automática daqui (vem do Meta)", () => {
    expect(chavesAutomaticas("trafego_pago")).toEqual([]);
    expect(extrasDoDia("trafego_pago", CONTAGEM_VAZIA)).toEqual({});
  });
  it("só as colunas com fonte aparecem", () => {
    expect(chavesAutomaticas("social_media")).toEqual(["vendas", "valor_total"]);
  });
});

describe("investimentoDoDia", () => {
  const c = { budget: 300, budget_period: "mensal" as const, start_date: "2026-10-01", end_date: null };
  it("mensal: um trinta avos por dia, só dentro da campanha e até hoje", () => {
    expect(investimentoDoDia(c, "2026-10-05", "2026-10-13")).toBe(10);
    expect(investimentoDoDia(c, "2026-09-30", "2026-10-13")).toBeNull();
    expect(investimentoDoDia(c, "2026-10-20", "2026-10-13")).toBeNull();
  });
  it("total: dividido pelos dias da campanha", () => {
    expect(
      investimentoDoDia(
        { budget: 1000, budget_period: "total", start_date: "2026-10-01", end_date: "2026-10-10" },
        "2026-10-03",
        "2026-10-13",
      ),
    ).toBe(100);
  });
  it("sem orçamento ou sem início: nada", () => {
    expect(investimentoDoDia({ ...c, budget: null }, "2026-10-05", "2026-10-13")).toBeNull();
    expect(investimentoDoDia({ ...c, start_date: null }, "2026-10-05", "2026-10-13")).toBeNull();
  });
});

describe("diaNoFuso", () => {
  it("meia-noite UTC ainda é o dia anterior em São Paulo", () => {
    expect(diaNoFuso("2026-10-13T01:00:00Z", "America/Sao_Paulo")).toBe("2026-10-12");
  });
});
