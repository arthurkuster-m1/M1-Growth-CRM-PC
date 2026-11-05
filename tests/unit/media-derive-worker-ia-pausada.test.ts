import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class LlmNotConfiguredError extends Error {}
  return {
    LlmNotConfiguredError,
    updates: [] as Array<Record<string, unknown>>,
    inserts: [] as unknown[],
    suspensa: { v: true },
    download: vi.fn(async () => ({ data: new Blob(["x"]), error: null })),
    resolve: vi.fn(async () => {
      throw new LlmNotConfiguredError("sem chave");
    }),
    info: vi.fn(),
  };
});

vi.mock("@/lib/navigation/suspensao", () => ({
  get IA_SUSPENSA() {
    return h.suspensa.v;
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: h.info, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/agent-engine/edge/llm/credentials", () => ({
  LlmNotConfiguredError: h.LlmNotConfiguredError,
  resolveOrgLlmConfig: h.resolve,
}));
vi.mock("@/lib/agent-engine/db/pool", () => ({ createPool: vi.fn(() => ({})) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ download: h.download }) },
    from: (tabela: string) => {
      const q: Record<string, unknown> = {};
      const cadeia = new Proxy(q, {
        get(_t, prop) {
          if (prop === "then") return undefined;
          if (prop === "update")
            return (v: Record<string, unknown>) => {
              h.updates.push({ tabela, ...v });
              return cadeia;
            };
          if (prop === "insert")
            return (v: unknown) => {
              h.inserts.push(v);
              return cadeia;
            };
          if (prop === "maybeSingle")
            return async () => ({
              data:
                tabela === "messages"
                  ? {
                      id: "m1",
                      organization_id: "o1",
                      conversation_id: "c1",
                      type: "image",
                      media_mime: "image/jpeg",
                      media_storage_path: "o1/x.jpg",
                      media_derived_status: null,
                      metadata: {},
                      direction: "inbound",
                      sent_via: null,
                      created_at: "2026-11-05T00:00:00Z",
                    }
                  : null,
              error: null,
            });
          return () => cadeia;
        },
      });
      return cadeia;
    },
  }),
}));

import { deriveMessageMedia } from "@/workers/media-derive-worker";

const row = {
  id: "e1",
  organization_id: "o1",
  entity_id: "m1",
  attempts: 4,
  payload: { message_id: "m1" },
} as never;

describe("derivação de mídia com a IA pausada ou sem chave", () => {
  beforeEach(() => {
    h.updates.length = 0;
    h.inserts.length = 0;
    h.download.mockClear();
    h.info.mockClear();
  });

  it("IA pausada: pula em silêncio, sem baixar, sem aviso, e o log diz por quê", async () => {
    h.suspensa.v = true;
    const r = await deriveMessageMedia(row);
    expect(r.status).toBe("skipped");
    expect(r.detail).toBe("ia_pausada");
    expect(h.download).not.toHaveBeenCalled();
    expect(h.inserts).toHaveLength(0);
    expect(h.updates).toEqual([{ tabela: "messages", media_derived_status: "skipped" }]);
    expect(h.info).toHaveBeenCalledWith(expect.stringContaining("IA está pausada"), expect.anything());
  });

  it("IA ligada mas sem chave: pula em silêncio, no último attempt também (sem event_dead)", async () => {
    h.suspensa.v = false;
    const r = await deriveMessageMedia(row);
    expect(r.status).toBe("skipped");
    expect(r.detail).toBe("ia_sem_chave");
    expect(h.inserts).toHaveLength(0);
    expect(h.info).toHaveBeenCalledWith(expect.stringContaining("nenhuma chave"), expect.anything());
  });
});
