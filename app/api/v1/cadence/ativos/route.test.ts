// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function fake(tabelas: Record<string, unknown[]>) {
  const from = (t: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit"]) c[m] = () => c;
    c.then = (ok: (v: unknown) => void) => ok({ data: tabelas[t] ?? [], error: null });
    return c;
  };
  return { from } as never;
}

describe("GET /cadence/ativos", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: { id: "u1", idioma: "pt-BR" },
      org: { orgId: "o1" },
    } as never);
  });

  it("diz o passo e o dia de cada lead; quem passou do último passo está aguardando", async () => {
    vi.mocked(createClient).mockResolvedValue(
      fake({
        demand_cadence_enrollments: [
          { lead_id: "a", cadence_id: "c1", current_step: 1, next_due_at: "2000-01-01T00:00:00Z" },
          { lead_id: "b", cadence_id: "c1", current_step: 2, next_due_at: "2999-01-01T00:00:00Z" },
        ],
        demand_cadence_steps: [
          { cadence_id: "c1", position: 0, day_offset: 0 },
          { cadence_id: "c1", position: 1, day_offset: 2 },
        ],
      }),
    );
    const corpo = (await (await GET()).json()) as {
      data: { leads: Array<Record<string, unknown>> };
    };
    expect(corpo.data.leads[0]).toMatchObject({
      lead_id: "a",
      passo: 2,
      total: 2,
      dia: 2,
      atrasado: true,
      aguardando: false,
    });
    expect(corpo.data.leads[1]).toMatchObject({
      lead_id: "b",
      passo: 2,
      dia: null,
      aguardando: true,
      atrasado: false,
    });
  });

  it("sem inscrição: lista vazia", async () => {
    vi.mocked(createClient).mockResolvedValue(fake({}));
    const corpo = (await (await GET()).json()) as { data: { leads: unknown[] } };
    expect(corpo.data.leads).toEqual([]);
  });
});
