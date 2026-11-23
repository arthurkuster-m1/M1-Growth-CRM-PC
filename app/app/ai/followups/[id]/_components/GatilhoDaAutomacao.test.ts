import { describe, expect, it } from "vitest";

import { montarGatilho } from "./GatilhoDaAutomacao";

const base = {
  evento: "lead.won" as const,
  condicoes: [],
  dias: 3,
  unidade: "dias" as const,
  direcao: "do_cliente" as const,
  configOriginal: null,
};

describe("montarGatilho", () => {
  it("evento simples vira gatilho 'event' sem parâmetros de tempo", () => {
    const r = montarGatilho(base);
    expect(r).toEqual({
      ok: true,
      config: { kind: "event", params: { event_type: "lead.won", conditions: [] } },
    });
  });

  it("descarta condição sem valor e mantém as preenchidas", () => {
    const r = montarGatilho({
      ...base,
      condicoes: [
        { field: "lead.tags", op: "contains", value: "Google" },
        { field: "lead.title", op: "eq", value: "  " },
      ],
    });
    expect(r.ok && r.config).toMatchObject({
      params: { conditions: [{ field: "lead.tags", op: "contains", value: "Google" }] },
    });
  });

  it("silêncio leva dias, unidade e direção para params.config", () => {
    const r = montarGatilho({
      ...base,
      evento: "lead.silent_for",
      dias: 2,
      unidade: "horas",
      direcao: "da_equipe",
    });
    expect(r.ok && r.config).toMatchObject({
      params: {
        event_type: "lead.silent_for",
        config: { dias: 2, unidade: "horas", direcao: "da_equipe" },
      },
    });
  });

  it("etapa parada leva só os dias", () => {
    const r = montarGatilho({ ...base, evento: "lead.stage_stale", dias: 7 });
    expect(r.ok && r.config).toMatchObject({ params: { config: { dias: 7 } } });
  });

  it("tempo inválido NÃO grava (nunca um gatilho que o relógio não sabe ler)", () => {
    expect(montarGatilho({ ...base, evento: "lead.silent_for", dias: 0 })).toMatchObject({
      ok: false,
    });
    expect(
      montarGatilho({ ...base, evento: "lead.silent_for", unidade: "horas", dias: 9999 }),
    ).toMatchObject({ ok: false });
    expect(montarGatilho({ ...base, evento: "lead.stage_stale", dias: -1 })).toMatchObject({
      ok: false,
    });
  });

  it("data do funil: os parâmetros da regra original passam INTACTOS", () => {
    const original = {
      pipeline_id: "11111111-1111-4111-8111-111111111111",
      campo: "data_do_casamento",
      dias: 30,
    };
    const r = montarGatilho({ ...base, evento: "lead.date_field_due", configOriginal: original });
    expect(r.ok && r.config).toMatchObject({
      params: { event_type: "lead.date_field_due", config: original },
    });
  });
});
