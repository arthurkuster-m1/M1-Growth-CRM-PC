import { describe, expect, it } from "vitest";

import { JANELA_PADRAO, janelaComCompromissos, lerJanela } from "./janela-da-grade";

const hm = (d: Date) => ({ hora: d.getUTCHours(), minuto: d.getUTCMinutes() });
const c = (comeca: string, termina: string, extra: Record<string, string> = {}) => ({
  comeca,
  termina,
  origem: "ui",
  situacao: "confirmed",
  ...extra,
});
const base = { primeira: 8, ultima: 16 }; // 08:00 às 17:00

describe("lerJanela", () => {
  it("lixo ou intervalo invertido volta ao padrão", () => {
    expect(lerJanela(null)).toEqual(JANELA_PADRAO);
    expect(lerJanela({ primeira: 20, ultima: 5 })).toEqual(JANELA_PADRAO);
    expect(lerJanela({ primeira: "8", ultima: 16 })).toEqual(JANELA_PADRAO);
    expect(lerJanela({ primeira: 8, ultima: 16 })).toEqual({ primeira: 8, ultima: 16 });
  });
});

describe("janelaComCompromissos", () => {
  it("sem compromisso fora do trecho, a janela é a escolhida", () => {
    const j = janelaComCompromissos(base, [c("2026-10-27T10:00:00Z", "2026-10-27T11:00:00Z")], hm);
    expect(j).toEqual(base);
  });
  it("reunião às 18:30 estica até as 19h; às 07:15 puxa o começo", () => {
    expect(
      janelaComCompromissos(base, [c("2026-10-27T18:30:00Z", "2026-10-27T19:00:00Z")], hm).ultima,
    ).toBe(19);
    expect(
      janelaComCompromissos(base, [c("2026-10-27T07:15:00Z", "2026-10-27T07:45:00Z")], hm).primeira,
    ).toBe(7);
  });
  it("fim em hora cheia não abre uma linha a mais", () => {
    expect(
      janelaComCompromissos(base, [c("2026-10-27T17:00:00Z", "2026-10-27T18:00:00Z")], hm).ultima,
    ).toBe(17);
  });
  it("ocupação do Google e cancelado não esticam a janela", () => {
    const g = c("2026-10-27T22:00:00Z", "2026-10-27T23:00:00Z", { origem: "google_sync" });
    const x = c("2026-10-27T21:00:00Z", "2026-10-27T22:00:00Z", { situacao: "cancelled" });
    expect(janelaComCompromissos(base, [g, x], hm)).toEqual(base);
  });
});
