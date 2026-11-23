import { describe, expect, it } from "vitest";

import { configDoGatilhoEstaCompleta } from "./config-do-gatilho";

const PIPELINE = "11111111-1111-4111-8111-111111111111";

describe("configDoGatilhoEstaCompleta", () => {
  it("evento sem parâmetro está sempre completo", () => {
    expect(configDoGatilhoEstaCompleta({ event_type: "lead.won" })).toBe(true);
    expect(configDoGatilhoEstaCompleta({ event_type: "message.received", config: {} })).toBe(true);
  });

  it("silêncio exige dias, unidade válida e direção", () => {
    const ok = { dias: 3, unidade: "dias", direcao: "do_cliente" };
    expect(configDoGatilhoEstaCompleta({ event_type: "lead.silent_for", config: ok })).toBe(true);
    expect(configDoGatilhoEstaCompleta({ event_type: "lead.silent_for" })).toBe(false);
    expect(
      configDoGatilhoEstaCompleta({
        event_type: "lead.silent_for",
        config: { ...ok, direcao: "x" },
      }),
    ).toBe(false);
    expect(
      configDoGatilhoEstaCompleta({ event_type: "lead.silent_for", config: { ...ok, dias: 0 } }),
    ).toBe(false);
  });

  it("etapa parada exige dias", () => {
    expect(
      configDoGatilhoEstaCompleta({ event_type: "lead.stage_stale", config: { dias: 5 } }),
    ).toBe(true);
    expect(configDoGatilhoEstaCompleta({ event_type: "lead.stage_stale", config: {} })).toBe(false);
  });

  it("data do funil exige funil, campo e dias", () => {
    const ok = { pipeline_id: PIPELINE, campo: "data_do_casamento", dias: 30 };
    expect(configDoGatilhoEstaCompleta({ event_type: "lead.date_field_due", config: ok })).toBe(
      true,
    );
    expect(
      configDoGatilhoEstaCompleta({ event_type: "lead.date_field_due", config: { dias: 30 } }),
    ).toBe(false);
    expect(configDoGatilhoEstaCompleta({ event_type: "lead.date_field_due" })).toBe(false);
  });
});
