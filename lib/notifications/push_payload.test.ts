import { describe, expect, it } from "vitest";

import { pushPayloadSchema, truncar } from "./push_payload";

describe("push_payload", () => {
  it("trunca corpo longo", () => {
    expect(truncar("a".repeat(141)).endsWith("…")).toBe(true);
    expect(truncar("oi").length).toBe(2);
  });

  it("aceita até dois botões e recusa o terceiro", () => {
    const base = { title: "Maria", body: "oi" };
    const botao = { rotulo: "Responder", href: "/app/inbox?id=c1" };
    expect(pushPayloadSchema.safeParse({ ...base, acoes: [botao, botao] }).success).toBe(true);
    expect(pushPayloadSchema.safeParse({ ...base, acoes: [botao, botao, botao] }).success).toBe(
      false,
    );
  });
});
