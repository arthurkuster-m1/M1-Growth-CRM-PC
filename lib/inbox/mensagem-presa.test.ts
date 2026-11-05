import { describe, expect, it } from "vitest";

import { mensagemEsperaReenvio, MOTIVO_NUMERO_FORA_DO_AR } from "./mensagem-presa";

const PRESA = {
  direction: "outbound",
  status: "queued",
  sent_via: "user",
  type: "text",
  metadata: { queued_reason: MOTIVO_NUMERO_FORA_DO_AR },
};

describe("mensagemEsperaReenvio", () => {
  it("mensagem de uma pessoa, na fila por causa do número, espera reenvio", () => {
    expect(mensagemEsperaReenvio(PRESA)).toBe(true);
    expect(mensagemEsperaReenvio({ ...PRESA, sent_via: "crm" })).toBe(true);
  });

  it("IA, automação e sistema NÃO: o reenvio automático delas já existe (redriveQueued)", () => {
    for (const sent_via of ["ai", "automation", "system"]) {
      expect(mensagemEsperaReenvio({ ...PRESA, sent_via })).toBe(false);
    }
  });

  it("só `queued` por causa do NÚMERO: outro motivo, outro status ou entrada não contam", () => {
    expect(
      mensagemEsperaReenvio({ ...PRESA, metadata: { queued_reason: "waha_not_configured" } }),
    ).toBe(false);
    expect(mensagemEsperaReenvio({ ...PRESA, metadata: {} })).toBe(false);
    expect(mensagemEsperaReenvio({ ...PRESA, metadata: null })).toBe(false);
    for (const status of ["sent", "delivered", "read", "failed", "sending"]) {
      expect(mensagemEsperaReenvio({ ...PRESA, status })).toBe(false);
    }
    expect(mensagemEsperaReenvio({ ...PRESA, direction: "inbound" })).toBe(false);
  });

  it("modelo (template) não: os valores dele não ficam gravados na linha", () => {
    expect(mensagemEsperaReenvio({ ...PRESA, type: "template" })).toBe(false);
  });
});
