import { describe, expect, it } from "vitest";

import {
  criacaoDeLinkSchema,
  enderecoDoLink,
  gerarToken,
  linkVigente,
  tokenSchema,
} from "@/lib/marketing/links";

describe("link sem login", () => {
  it("o token tem 256 bits, é único e passa no formato aceito pela rota pública", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => gerarToken()));
    expect(tokens.size).toBe(200);
    for (const t of tokens) {
      expect(t.length).toBe(43);
      expect(tokenSchema.safeParse(t).success).toBe(true);
    }
  });

  it("a rota pública descarta o que não parece um token, sem tocar no banco", () => {
    for (const ruim of [
      "",
      "abc",
      "a".repeat(31),
      "a".repeat(65),
      "../etc/passwd" + "a".repeat(30),
      "a b".repeat(20),
    ]) {
      expect(tokenSchema.safeParse(ruim).success, `"${ruim.slice(0, 20)}" não deveria valer`).toBe(
        false,
      );
    }
  });

  it("vigência: revogado ou vencido não vale", () => {
    const agora = new Date("2026-10-09T12:00:00Z");
    expect(linkVigente({ expires_at: null, revoked_at: null }, agora)).toBe(true);
    expect(linkVigente({ expires_at: "2026-10-10T00:00:00Z", revoked_at: null }, agora)).toBe(true);
    expect(linkVigente({ expires_at: "2026-10-09T12:00:00Z", revoked_at: null }, agora)).toBe(
      false,
    );
    expect(linkVigente({ expires_at: "2026-10-01T00:00:00Z", revoked_at: null }, agora)).toBe(
      false,
    );
    expect(linkVigente({ expires_at: null, revoked_at: "2026-10-09T11:00:00Z" }, agora)).toBe(
      false,
    );
  });

  it("criação: escopo é um módulo conhecido (ou o painel inteiro); validade de 1 a 365 dias", () => {
    expect(criacaoDeLinkSchema.safeParse({}).success).toBe(true);
    expect(
      criacaoDeLinkSchema.safeParse({ module_key: "onboarding", expires_in_days: 30 }).success,
    ).toBe(true);
    expect(criacaoDeLinkSchema.safeParse({ module_key: "inventado" }).success).toBe(false);
    expect(criacaoDeLinkSchema.safeParse({ expires_in_days: 0 }).success).toBe(false);
    expect(criacaoDeLinkSchema.safeParse({ expires_in_days: 366 }).success).toBe(false);
  });

  it("o endereço copiado é origem + /p/ + token", () => {
    expect(enderecoDoLink("https://x.com/", "abc")).toBe("https://x.com/p/abc");
  });
});
