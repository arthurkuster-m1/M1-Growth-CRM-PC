import { describe, expect, it } from "vitest";

import { snoozeSchema } from "@/lib/schemas/snooze";

describe("snoozeSchema", () => {
  it("aceita duration_hours 1, 3 e 24", () => {
    expect(snoozeSchema.safeParse({ duration_hours: 1 }).success).toBe(true);
    expect(snoozeSchema.safeParse({ duration_hours: 3 }).success).toBe(true);
    expect(snoozeSchema.safeParse({ duration_hours: 24 }).success).toBe(true);
  });
  it("rejeita valores fora do enum fechado", () => {
    expect(snoozeSchema.safeParse({ duration_hours: 0 }).success).toBe(false);
    expect(snoozeSchema.safeParse({ duration_hours: 5 }).success).toBe(false);
    expect(snoozeSchema.safeParse({ duration_hours: -1 }).success).toBe(false);
  });
  it("rejeita string em vez de number", () => {
    expect(snoozeSchema.safeParse({ duration_hours: "1" }).success).toBe(false);
  });
});

describe("snoozeSchema — o Outro (data e hora)", () => {
  it("aceita uma data ISO com fuso", () => {
    expect(snoozeSchema.safeParse({ snooze_until: "2030-01-01T12:00:00-03:00" }).success).toBe(true);
    expect(snoozeSchema.safeParse({ snooze_until: "amanhã" }).success).toBe(false);
  });
  it("só vale no futuro e até um ano", async () => {
    const { instanteDoLembrete } = await import("@/lib/schemas/snooze");
    const agora = Date.parse("2026-10-29T12:00:00Z");
    expect(instanteDoLembrete({ snooze_until: "2026-10-29T11:00:00Z" }, agora)).toBeNull();
    expect(instanteDoLembrete({ snooze_until: "2026-10-30T09:00:00Z" }, agora)?.toISOString()).toBe(
      "2026-10-30T09:00:00.000Z",
    );
    expect(instanteDoLembrete({ snooze_until: "2028-01-01T00:00:00Z" }, agora)).toBeNull();
    expect(instanteDoLembrete({ duration_hours: 3 }, agora)?.toISOString()).toBe(
      "2026-10-29T15:00:00.000Z",
    );
  });
});
