import { describe, expect, it } from "vitest";

import { textoDaAcao } from "./acoes-do-lead";

describe("textoDaAcao", () => {
  it("ligação com resultado e comentário", () => {
    expect(textoDaAcao("ligacao", "Atendeu — pediu para retornar", "Ligar terça às 10h")).toBe(
      "Follow-up — Ligação — Resultado: Atendeu — pediu para retornar — Ligar terça às 10h",
    );
  });
  it("sem resultado nem comentário, só o rótulo", () => {
    expect(textoDaAcao("remarcou", undefined, "")).toBe("Lead remarcou");
  });
  it("corta o texto em 1000 caracteres", () => {
    expect(textoDaAcao("outro", null, "x".repeat(2000)).length).toBe(1000);
  });
});
