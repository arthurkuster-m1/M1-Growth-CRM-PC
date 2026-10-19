import { beforeEach, describe, expect, it, vi } from "vitest";

import { desfazerUltimo, limparDesfazer, podeDesfazer, registrarDesfazer, valoresAntes } from "./desfazer";

describe("desfazer (Ctrl+Z das tabelas)", () => {
  beforeEach(() => limparDesfazer());

  it("desfaz na ordem inversa, uma por vez", async () => {
    const ordem: string[] = [];
    registrarDesfazer({ desfazer: () => void ordem.push("a") });
    registrarDesfazer({ desfazer: () => void ordem.push("b") });
    await desfazerUltimo();
    await desfazerUltimo();
    expect(ordem).toEqual(["b", "a"]);
    expect(podeDesfazer()).toBe(false);
    expect(await desfazerUltimo()).toBeNull();
  });

  it("o próprio desfazer não entra na pilha (senão Ctrl+Z desfaria o desfazer)", async () => {
    registrarDesfazer({ desfazer: () => registrarDesfazer({ desfazer: vi.fn() }) });
    await desfazerUltimo();
    expect(podeDesfazer()).toBe(false);
  });

  it("valoresAntes guarda só as chaves editadas, com o valor de antes", () => {
    expect(valoresAntes({ a: 1, b: 2, c: undefined }, { a: 9, c: 3 })).toEqual({ a: 1, c: null });
  });
});
