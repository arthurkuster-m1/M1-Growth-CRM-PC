import { describe, expect, it } from "vitest";

import { contaLiberada, contasVisiveis } from "./credenciais-de-leitura";

const restrita = { restringir: true, contasPermitidas: ["act_111", "222"] };
const livre = { restringir: false, contasPermitidas: [] };

describe("contaLiberada", () => {
  it("token da própria empresa (sem restrição) vê qualquer conta que alcança", () => {
    expect(contaLiberada(livre, "act_999")).toBe(true);
  });
  it("token da agência: só as contas liberadas, com ou sem o prefixo act_", () => {
    expect(contaLiberada(restrita, "act_111")).toBe(true);
    expect(contaLiberada(restrita, "111")).toBe(true);
    expect(contaLiberada(restrita, "act_222")).toBe(true);
    expect(contaLiberada(restrita, "act_333")).toBe(false);
  });
  it("restrita com lista vazia não libera nenhuma (fail-closed) e conta vazia nunca passa", () => {
    expect(contaLiberada({ restringir: true, contasPermitidas: [] }, "act_111")).toBe(false);
    expect(contaLiberada(restrita, null)).toBe(false);
    expect(contaLiberada(restrita, "")).toBe(false);
  });
});

describe("contasVisiveis", () => {
  it("filtra a lista que o token alcança pelas liberadas", () => {
    const todas = [{ id: "act_111" }, { id: "act_333" }, { id: "act_222" }];
    expect(contasVisiveis(restrita, todas).map((c) => c.id)).toEqual(["act_111", "act_222"]);
    expect(contasVisiveis(livre, todas)).toHaveLength(3);
  });
});
