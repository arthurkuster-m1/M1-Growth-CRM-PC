import { describe, expect, it } from "vitest";

import { gravarNoCaminho, lerNoCaminho } from "./caminho";

describe("caminho dentro do bloco", () => {
  const bloco = { id: "a", itens: [{ titulo: "x" }, { titulo: "y" }] };
  it("lê e grava sem mutar", () => {
    expect(lerNoCaminho(bloco, ["itens", 1, "titulo"])).toBe("y");
    const novo = gravarNoCaminho(bloco, ["itens", 1, "titulo"], "z");
    expect(novo.itens[1]!.titulo).toBe("z");
    expect(bloco.itens[1]!.titulo).toBe("y");
    expect(novo.itens[0]).toBe(bloco.itens[0]);
  });
  it("caminho que não existe lê undefined", () => {
    expect(lerNoCaminho(bloco, ["itens", 5, "titulo"])).toBeUndefined();
  });
});
