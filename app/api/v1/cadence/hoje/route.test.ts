// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function fake(tabelas: Record<string, unknown[]>) {
  const from = (t: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "lte", "order", "in", "limit"]) c[m] = () => c;
    c.then = (ok: (v: unknown) => void) => ok({ data: tabelas[t] ?? [], error: null });
    return c;
  };
  return { from } as never;
}

describe("GET /cadence/hoje", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: { id: "u1", idioma: "pt-BR" },
      org: { orgId: ORG },
    } as never);
  });

  it("monta o passo da vez com a abordagem; quem passou do último passo não entra", async () => {
    vi.mocked(createClient).mockResolvedValue(
      fake({
        demand_cadence_enrollments: [
          { lead_id: "l1", cadence_id: "c1", current_step: 1, next_due_at: "2026-10-20T12:00:00Z" },
          { lead_id: "l2", cadence_id: "c1", current_step: 2, next_due_at: "2026-10-20T12:00:00Z" },
        ],
        demand_cadence_steps: [
          {
            cadence_id: "c1",
            position: 0,
            day_offset: 0,
            medium: "ligacao",
            approach_id: null,
            note: "",
          },
          {
            cadence_id: "c1",
            position: 1,
            day_offset: 2,
            medium: "whatsapp",
            approach_id: "a1",
            note: "citar a vaga",
          },
        ],
        demand_campaign_approaches: [{ id: "a1", name: "Gancho", hook: "Oi", script: "Texto" }],
      }),
    );
    const r = await GET();
    const corpo = (await r.json()) as { data: { passos: Array<Record<string, unknown>> } };
    expect(corpo.data.passos).toHaveLength(1);
    expect(corpo.data.passos[0]).toMatchObject({
      lead_id: "l1",
      passo: 2,
      total: 2,
      medium: "whatsapp",
      nota: "citar a vaga",
      abordagem: { id: "a1", name: "Gancho" },
    });
  });

  it("sem inscrição vencendo: lista vazia", async () => {
    vi.mocked(createClient).mockResolvedValue(fake({}));
    const corpo = (await (await GET()).json()) as { data: { passos: unknown[] } };
    expect(corpo.data.passos).toEqual([]);
  });
});
