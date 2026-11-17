import { describe, expect, it } from "vitest";

import { origemMetaDaCaptacao } from "@/lib/webhooks/origem-meta-da-captacao";
import { ehNomeDeEventoValido } from "@/lib/conversoes/regras-meta";

const AGORA = 1_760_000_000_000;

describe("lead de webhook (n8n) que veio de anúncio da Meta", () => {
  it("UTM da Meta marca a origem; a UTM vai junto", () => {
    const o = origemMetaDaCaptacao({}, { utm_source: "Facebook", utm_campaign: "promo" }, AGORA);
    expect(o).toEqual({
      utm: { utm_source: "Facebook", utm_campaign: "promo" },
      fbc: null,
      fbp: null,
    });
    for (const s of ["meta", "fb", "instagram", "ig"]) {
      expect(origemMetaDaCaptacao({}, { utm_source: s }, AGORA)).not.toBeNull();
    }
  });

  it("UTM de outra fonte, ou nenhuma, é orgânico: nada é gravado", () => {
    expect(origemMetaDaCaptacao({}, { utm_source: "google" }, AGORA)).toBeNull();
    expect(origemMetaDaCaptacao({}, { utm_source: "newsletter" }, AGORA)).toBeNull();
    expect(origemMetaDaCaptacao({ cidade: "SP" }, {}, AGORA)).toBeNull();
    // fbclid solto NÃO vence uma UTM declarada de outra fonte
    expect(
      origemMetaDaCaptacao({ fbclid: "abc123456" }, { utm_source: "google" }, AGORA),
    ).toBeNull();
  });

  it("fbclid sem UTM vira origem Facebook e monta o cookie fbc", () => {
    const o = origemMetaDaCaptacao({ fbclid: "IwAR0abcdef123" }, {}, AGORA)!;
    expect(o.utm.utm_source).toBe("facebook");
    expect(o.fbc).toBe(`fb.1.${AGORA}.IwAR0abcdef123`);
  });

  it("aceita os cookies _fbc e _fbp (também aninhados) e descarta os malformados", () => {
    const o = origemMetaDaCaptacao(
      {
        tracking_fbc: "fb.1.1759000000000.IwAR0abcdef123",
        tracking_fbp: "fb.1.1759000000000.1234567890",
      },
      {},
      AGORA,
    )!;
    expect(o.fbc).toBe("fb.1.1759000000000.IwAR0abcdef123");
    expect(o.fbp).toBe("fb.1.1759000000000.1234567890");
    const ruim = origemMetaDaCaptacao({ fbp: "lixo" }, { utm_source: "meta" }, AGORA)!;
    expect(ruim.fbp).toBeNull();
  });
});

describe("evento personalizado da Meta", () => {
  it("aceita nome simples e recusa o que a Meta ou o banco recusariam", () => {
    expect(ehNomeDeEventoValido("AgendouVisita")).toBe(true);
    expect(ehNomeDeEventoValido("visita_agendada_2")).toBe(true);
    expect(ehNomeDeEventoValido("")).toBe(false);
    expect(ehNomeDeEventoValido("1Visita")).toBe(false);
    expect(ehNomeDeEventoValido("com espaço")).toBe(false);
    expect(ehNomeDeEventoValido("a".repeat(41))).toBe(false);
    expect(ehNomeDeEventoValido("Evento'--")).toBe(false);
  });
});
