import { describe, expect, it } from "vitest";

import { atrasoEmDias, venceAteHoje } from "./hoje";

describe("atrasoEmDias", () => {
  it("0 no dia, positivo depois, negativo antes", () => {
    const vence = new Date(2026, 9, 20, 15, 0).toISOString();
    expect(atrasoEmDias(vence, "2026-10-20")).toBe(0);
    expect(atrasoEmDias(vence, "2026-10-23")).toBe(3);
    expect(atrasoEmDias(vence, "2026-10-19")).toBe(-1);
    expect(venceAteHoje(vence, "2026-10-21")).toBe(true);
    expect(venceAteHoje(vence, "2026-10-19")).toBe(false);
  });
});

describe("rotuloDaCadencia", () => {
  it("diz o dia e o passo, ou que aguarda a resposta", async () => {
    const { rotuloDaCadencia } = await import("./hoje");
    const base = { lead_id: "l", total: 3, atrasado: false };
    expect(rotuloDaCadencia({ ...base, passo: 1, dia: 0, aguardando: false })).toBe(
      "D0 · passo 1 de 3",
    );
    expect(rotuloDaCadencia({ ...base, passo: 2, dia: 2, aguardando: false })).toBe(
      "D+2 · passo 2 de 3",
    );
    expect(rotuloDaCadencia({ ...base, passo: 3, dia: null, aguardando: true })).toBe(
      "aguardando resposta",
    );
  });
});
