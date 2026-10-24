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
