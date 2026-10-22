import { describe, expect, it } from "vitest";

import { dolarEmReais, lerCambioGuardado } from "./cambio";

describe("câmbio das extrações", () => {
  it("converte dólar em real com o IOF", () => {
    expect(dolarEmReais(10, { taxa: 5, origem: "automatica", iofPct: 3.5 })).toBe(51.75);
  });
  it("sem cotação não inventa valor", () => {
    expect(dolarEmReais(10, { taxa: null, origem: "indisponivel", iofPct: 3.5 })).toBeNull();
  });
  it("lê o guardado com o IOF padrão e ignora lixo", () => {
    expect(lerCambioGuardado(null)).toEqual({ usdBrl: null, iofPct: 3.5 });
    expect(lerCambioGuardado({ dashboards: { cambio: { usd_brl: 5.4, iof_pct: 6.38 } } })).toEqual({
      usdBrl: 5.4,
      iofPct: 6.38,
    });
    expect(lerCambioGuardado({ dashboards: { cambio: { usd_brl: -1, iof_pct: 99 } } })).toEqual({
      usdBrl: null,
      iofPct: 3.5,
    });
  });
});
