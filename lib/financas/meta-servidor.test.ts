import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { uuidDoTexto } from "./meta-servidor";

describe("uuidDoTexto", () => {
  it("é estável, tem formato de uuid e muda com o texto", () => {
    const a = uuidDoTexto("org:1");
    expect(a).toBe(uuidDoTexto("org:1"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidDoTexto("org:2")).not.toBe(a);
  });
});
