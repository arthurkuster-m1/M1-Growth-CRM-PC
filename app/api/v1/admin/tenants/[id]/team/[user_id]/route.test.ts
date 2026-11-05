import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PATCH /admin/tenants/[id]/team/[user_id]: papel, revogar e reativar pelo super-admin.
 * Guarda: escopo de escrita, travas do ÚLTIMO admin, filtro por organization_id do CAMINHO.
 */
class Negada extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const h = vi.hoisted(() => ({
  ator: "aaaaaaaa-0000-4000-8000-000000000001",
  negar: null as string | null,
  alvo: null as Record<string, unknown> | null,
  admins: 2,
  abertas: [] as Array<{ id: string; contact_id: string | null }>,
  updates: [] as Array<{ valores: unknown; filtros: [string, unknown][] }>,
  buscas: [] as Array<[string, unknown][]>,
  audit: vi.fn(),
  troca: vi.fn(),
}));

vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: async () => null }));
vi.mock("@/lib/audit", () => ({ audit: h.audit }));
vi.mock("@/lib/inbox/atividade-de-comando", () => ({ registrarTrocaDeComando: h.troca }));
vi.mock("@/lib/auth/requirePlatformAdmin", async () => {
  const { fail } = await import("@/lib/api/wrappers");
  return {
    requirePlatformAdminEscrita: async () => {
      if (h.negar) throw new Negada(h.negar);
      return { user: { id: h.ator }, platformAdmin: { scope: "full" } };
    },
    falhaDaEscritaDePlatformAdmin: (err: unknown, requestId?: string) =>
      fail(err instanceof Negada ? err.code : "forbidden", "negado", 403, { requestId }),
  };
});
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabela: string) => {
      const filtros: [string, unknown][] = [];
      let valores: unknown = null;
      let contagem = false;
      const c: Record<string, unknown> = {};
      c.select = (_cols: string, opts?: { head?: boolean }) => ((contagem = !!opts?.head), c);
      c.update = (v: unknown) => {
        valores = v;
        h.updates.push({ valores, filtros });
        return c;
      };
      c.eq = (col: string, val: unknown) => (filtros.push([col, val]), c);
      c.is = () => c;
      c.in = () => c;
      c.maybeSingle = async () => (h.buscas.push(filtros), { data: h.alvo, error: null });
      c.then = (ok: (r: unknown) => unknown) =>
        Promise.resolve(
          contagem
            ? { count: h.admins, error: null }
            : tabela === "conversations"
              ? { data: h.abertas, error: null }
              : { error: null },
        ).then(ok);
      return c;
    },
  }),
}));

import { PATCH } from "./route";

const TENANT = "bbbbbbbb-0000-4000-8000-000000000001";
const ALVO = "cccccccc-0000-4000-8000-000000000002";
const ctx = { params: Promise.resolve({ id: TENANT, user_id: ALVO }) };
const pedido = (body: unknown) =>
  new NextRequest(`http://localhost/api/v1/admin/tenants/${TENANT}/team/${ALVO}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.negar = null;
  h.admins = 2;
  h.abertas = [];
  h.updates = [];
  h.buscas = [];
  h.alvo = { id: "m1", user_id: ALVO, role: "agent", revoked_at: null };
});

describe("PATCH /admin/tenants/[id]/team/[user_id]", () => {
  it("sem escrita de platform admin → 403, nada gravado", async () => {
    h.negar = "forbidden_scope";
    expect((await PATCH(pedido({ role: "admin" }), ctx)).status).toBe(403);
    expect(h.updates).toEqual([]);
  });

  it("troca o papel filtrando pela organização do CAMINHO e audita", async () => {
    const res = await PATCH(pedido({ role: "manager" }), ctx);
    expect(res.status).toBe(200);
    expect(h.buscas[0]).toContainEqual(["organization_id", TENANT]);
    expect(h.updates[0]?.filtros).toContainEqual(["organization_id", TENANT]);
    expect(h.audit.mock.calls[0]?.[0]).toMatchObject({
      action: "team.role_changed",
      organizationId: TENANT,
      metadata: { old_role: "agent", new_role: "manager" },
    });
  });

  it("rebaixar ou revogar o ÚLTIMO admin → 409 sem gravar", async () => {
    h.alvo = { id: "m1", user_id: ALVO, role: "admin", revoked_at: null };
    h.admins = 1;
    expect((await PATCH(pedido({ role: "agent" }), ctx)).status).toBe(409);
    expect((await PATCH(pedido({ revoked: true }), ctx)).status).toBe(409);
    expect(h.updates).toEqual([]);
  });

  it("com outro admin, rebaixar passa", async () => {
    h.alvo = { id: "m1", user_id: ALVO, role: "admin", revoked_at: null };
    h.admins = 2;
    expect((await PATCH(pedido({ role: "agent" }), ctx)).status).toBe(200);
  });

  it("revogar libera as conversas abertas e audita; reativar devolve o acesso", async () => {
    h.abertas = [{ id: "conv1", contact_id: "ct1" }];
    expect((await PATCH(pedido({ revoked: true }), ctx)).status).toBe(200);
    expect(h.troca).toHaveBeenCalledTimes(1);
    const acoes = h.audit.mock.calls.map((c) => c[0].action);
    expect(acoes).toEqual(["conversation.released", "member.revoked"]);

    h.audit.mockClear();
    h.alvo = { id: "m1", user_id: ALVO, role: "agent", revoked_at: "2026-01-01T00:00:00Z" };
    expect((await PATCH(pedido({ revoked: false }), ctx)).status).toBe(200);
    expect(h.audit.mock.calls[0]?.[0].action).toBe("member.reactivated");
  });

  it("mudar o papel de revogado → 409; membro de outra empresa → 404; corpo misto → 400", async () => {
    h.alvo = { id: "m1", user_id: ALVO, role: "agent", revoked_at: "2026-01-01T00:00:00Z" };
    expect((await PATCH(pedido({ role: "admin" }), ctx)).status).toBe(409);
    h.alvo = null;
    expect((await PATCH(pedido({ role: "admin" }), ctx)).status).toBe(404);
    expect((await PATCH(pedido({ role: "admin", revoked: true }), ctx)).status).toBe(400);
  });
});
