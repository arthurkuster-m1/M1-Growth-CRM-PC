import { describe, expect, it } from "vitest";

import { deixariaSemAdmin, mudancaDeAcesso } from "./delegacao";

describe("mudança de acesso", () => {
  it("sem associação, pedir um papel concede; pedir nada não faz nada", () => {
    expect(mudancaDeAcesso(null, "manager")).toEqual({ tipo: "conceder", papel: "manager" });
    expect(mudancaDeAcesso(null, null)).toEqual({ tipo: "nada" });
  });
  it("com associação, trocar de papel altera e tirar revoga", () => {
    expect(mudancaDeAcesso("manager", "admin")).toEqual({ tipo: "alterar", papel: "admin" });
    expect(mudancaDeAcesso("manager", "manager")).toEqual({ tipo: "nada" });
    expect(mudancaDeAcesso("admin", null)).toEqual({ tipo: "revogar" });
  });
});

describe("último admin", () => {
  it("não deixa tirar nem rebaixar o último admin do cliente", () => {
    expect(deixariaSemAdmin("admin", null, 1)).toBe(true);
    expect(deixariaSemAdmin("admin", "manager", 1)).toBe(true);
    expect(deixariaSemAdmin("admin", null, 2)).toBe(false);
    expect(deixariaSemAdmin("manager", null, 1)).toBe(false);
  });
});
