import { describe, expect, it } from "vitest";

import { classificarRespostaDeConfirmacao as c } from "./resposta-de-confirmacao";

describe("resposta de confirmação", () => {
  it("entende a confirmação", () => {
    for (const t of ["1", "Sim", "sim!", "Confirmo", "ok", "Pode ser", "Estarei lá", "👍 sim"]) {
      expect(c(t), t).toBe("confirmed");
    }
  });
  it("entende remarcar e cancelar, e 'não vou' não vira 'vou'", () => {
    expect(c("2")).toBe("reschedule");
    expect(c("Preciso remarcar")).toBe(null); // frase que não começa com a intenção: não age
    expect(c("remarcar")).toBe("reschedule");
    expect(c("outro dia")).toBe("reschedule");
    expect(c("3")).toBe("cancel");
    expect(c("não vou conseguir")).toBe("cancel");
    expect(c("Cancela por favor")).toBe("cancel");
  });
  it("na dúvida não age", () => {
    expect(c("")).toBe(null);
    expect(c("oi, tudo bem? queria saber o endereço de novo e também se tem estacionamento no local")).toBe(null);
    expect(c("talvez")).toBe(null);
  });
});
