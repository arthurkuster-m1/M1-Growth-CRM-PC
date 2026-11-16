import { describe, expect, it } from "vitest";

import { entradaPorExtenso, lerEntradaDoLead } from "./data-do-lead";

const AGORA = Date.parse("2026-11-16T12:00:00-03:00");

describe("lerEntradaDoLead", () => {
  it("vazio = não informado", () => {
    expect(lerEntradaDoLead("", "", AGORA)).toEqual({
      ok: true,
      iso: null,
      data: null,
      hora: null,
    });
  });

  it("data e horário em colunas separadas (fuso de Brasília)", () => {
    expect(lerEntradaDoLead("16/11/2026", "14:30", AGORA)).toEqual({
      ok: true,
      iso: "2026-11-16T14:30:00-03:00",
      data: "2026-11-16",
      hora: "14:30",
    });
  });

  it("horário na mesma célula da data, ISO, ano com 2 dígitos e hora com h", () => {
    expect(lerEntradaDoLead("05/11/2026 9:05", "", AGORA)).toMatchObject({
      iso: "2026-11-05T09:05:00-03:00",
    });
    expect(lerEntradaDoLead("2026-11-05", "08:15:30", AGORA)).toMatchObject({
      iso: "2026-11-05T08:15:30-03:00",
    });
    expect(lerEntradaDoLead("05/11/26", "9h30", AGORA)).toMatchObject({
      iso: "2026-11-05T09:30:00-03:00",
    });
  });

  it("sem horário vale 00:00 e a revisão não mostra hora", () => {
    expect(lerEntradaDoLead("05/11/2026", "", AGORA)).toMatchObject({
      iso: "2026-11-05T00:00:00-03:00",
      hora: null,
    });
  });

  it("recusa data ou horário que não existem, horário sem data e data no futuro", () => {
    expect(lerEntradaDoLead("31/02/2026", "", AGORA)).toMatchObject({ ok: false });
    expect(lerEntradaDoLead("05/11/2026", "25:00", AGORA)).toMatchObject({ ok: false });
    expect(lerEntradaDoLead("", "14:30", AGORA)).toMatchObject({ ok: false });
    expect(lerEntradaDoLead("20/12/2026", "", AGORA)).toMatchObject({ ok: false });
  });

  it("entradaPorExtenso", () => {
    expect(entradaPorExtenso("2026-11-16", "14:30")).toBe("16/11/2026 14:30");
    expect(entradaPorExtenso("2026-11-16", null)).toBe("16/11/2026");
  });
});
