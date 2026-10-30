import { describe, expect, it } from "vitest";

import { corDoCliente, ehHexValido, PALETA_DE_CLIENTES } from "./cor-do-cliente";

describe("cor do cliente", () => {
  it("usa a escolhida quando é um hex válido", () => {
    expect(corDoCliente("#3B78D8", "x")).toBe("#3b78d8");
  });
  it("sem escolha (ou com lixo), cai numa cor da paleta, sempre a mesma para o mesmo cliente", () => {
    const a = corDoCliente(null, "cliente-1");
    expect(PALETA_DE_CLIENTES).toContain(a);
    expect(corDoCliente("azul", "cliente-1")).toBe(a);
    expect(corDoCliente(undefined, "cliente-1")).toBe(a);
  });
  it("valida o hex", () => {
    expect(ehHexValido("#abcdef")).toBe(true);
    expect(ehHexValido("#abc")).toBe(false);
    expect(ehHexValido(5)).toBe(false);
  });
});
