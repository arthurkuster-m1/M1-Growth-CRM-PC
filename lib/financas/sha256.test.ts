import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { sha256HexPuro } from "./sha256";
import { sha256Hex } from "./importacao";

describe("sha256HexPuro", () => {
  it("bate com os vetores conhecidos do SHA-256", () => {
    expect(sha256HexPuro("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256HexPuro("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256HexPuro("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("bate com o do Node em textos com acento e de vários tamanhos (inclusive nas bordas do bloco)", () => {
    for (const n of [0, 1, 54, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      const t = "ç é ã—".repeat(Math.ceil(n / 6)).slice(0, n);
      expect(sha256HexPuro(t)).toBe(createHash("sha256").update(t, "utf8").digest("hex"));
    }
  });

  it("sha256Hex (o do app) devolve o mesmo valor", async () => {
    expect(await sha256Hex("Venda — Clínica;120,50")).toBe(
      createHash("sha256").update("Venda — Clínica;120,50", "utf8").digest("hex"),
    );
  });
});
