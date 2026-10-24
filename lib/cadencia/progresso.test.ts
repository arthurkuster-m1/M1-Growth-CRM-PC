// @vitest-environment node
import { describe, expect, it } from "vitest";

import { registrarTentativaNaCadencia } from "./progresso";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEAD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/** Um banco de brinquedo: devolve a inscrição e os passos, e guarda o que foi atualizado. */
function fake(inscricao: Record<string, unknown> | null, dias: number[]) {
  const updates: Record<string, unknown>[] = [];
  const from = (tabela: string) => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.limit = async () => ({ data: dias.map((d) => ({ day_offset: d })), error: null });
    c.maybeSingle = async () => ({
      data: tabela === "demand_cadence_enrollments" ? inscricao : null,
    });
    c.update = (patch: Record<string, unknown>) => {
      updates.push(patch);
      return c;
    };
    c.then = (ok: (v: unknown) => void) => ok({ data: null, error: null });
    return c;
  };
  return { admin: { from } as never, updates };
}

const inscricao = (current_step: number) => ({
  id: "i1",
  cadence_id: "c1",
  current_step,
  started_at: "2026-10-01T12:00:00.000Z",
});

describe("registrarTentativaNaCadencia", () => {
  it("lead sem inscrição ativa: nada acontece", async () => {
    const f = fake(null, [0, 2]);
    expect(
      await registrarTentativaNaCadencia(f.admin, {
        organizationId: ORG,
        leadId: LEAD,
        respondeu: false,
      }),
    ).toBe("sem_cadencia");
    expect(f.updates).toHaveLength(0);
  });

  it("respondeu: a inscrição vira 'respondeu' e perde a data", async () => {
    const f = fake(inscricao(0), [0, 2]);
    const r = await registrarTentativaNaCadencia(f.admin, {
      organizationId: ORG,
      leadId: LEAD,
      respondeu: true,
    });
    expect(r).toBe("respondeu");
    expect(f.updates[0]).toMatchObject({ status: "respondeu", next_due_at: null });
  });

  it("sem resposta: o próximo passo vence no dia dele, contado do início", async () => {
    const f = fake(inscricao(0), [0, 2, 5]);
    await registrarTentativaNaCadencia(f.admin, {
      organizationId: ORG,
      leadId: LEAD,
      respondeu: false,
      agora: new Date("2026-10-01T15:00:00Z"),
    });
    expect(f.updates[0]).toMatchObject({
      current_step: 1,
      next_due_at: "2026-10-03T12:00:00.000Z",
    });
  });

  it("depois do último passo vem o prazo de resposta; tentativa extra não muda nada", async () => {
    const f = fake(inscricao(1), [0, 2]);
    await registrarTentativaNaCadencia(f.admin, {
      organizationId: ORG,
      leadId: LEAD,
      respondeu: false,
      agora: new Date("2026-10-03T12:00:00Z"),
    });
    expect(f.updates[0]).toMatchObject({
      current_step: 2,
      next_due_at: "2026-10-05T12:00:00.000Z",
    });

    const g = fake(inscricao(2), [0, 2]);
    await registrarTentativaNaCadencia(g.admin, {
      organizationId: ORG,
      leadId: LEAD,
      respondeu: false,
    });
    expect(g.updates).toHaveLength(0);
  });
});
