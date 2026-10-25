import { describe, expect, it } from "vitest";

import { normalizarTag } from "./tag-normalizada";

describe("as tags da abordagem mantêm a caixa e o nome inteiro", () => {
  it("Contato, Contato com decisor e Abordagem: … não viram minúsculas nem são cortadas em 40", () => {
    expect(normalizarTag("contato")).toBe("Contato");
    expect(normalizarTag("CONTATO COM DECISOR")).toBe("Contato com decisor");
    const longa = "Abordagem: Teste - abordagem completa para clínicas de estética: 2x";
    expect(normalizarTag(longa)).toBe(longa.slice(0, 60));
  });

  it("tag digitada à mão segue em minúsculas e cortada em 40", () => {
    expect(normalizarTag("  VIP  ")).toBe("vip");
  });
});
