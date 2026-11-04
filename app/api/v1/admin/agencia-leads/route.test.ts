import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  negar: false,
  semOrg: false,
  filtros: [] as Array<[string, unknown]>,
  busca: null as string | null,
}));

vi.mock("@/lib/auth/requirePlatformAdmin", () => ({
  requirePlatformAdmin: async () => {
    if (h.negar) throw new Error("no");
    return { user: { id: "u" } };
  },
}));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: async () => ({ id: "u" }),
  resolveActiveOrg: async () => (h.semOrg ? null : { orgId: "org-agencia", name: "Assessoria M1" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = (col: string, val: unknown) => (h.filtros.push([col, val]), c);
      c.order = () => c;
      c.limit = () => c;
      c.ilike = (_col: string, v: string) => ((h.busca = v), c);
      c.then = (ok: (r: unknown) => unknown) =>
        Promise.resolve({
          data: [
            { id: "l1", title: "Aurora", status: "won", contact: { name: "Dra", email: "a@b.c" } },
          ],
          error: null,
        }).then(ok);
      return c;
    },
  }),
}));

import { GET } from "./route";

const pedido = (qs = "") => new NextRequest(`http://localhost/api/v1/admin/agencia-leads?${qs}`);

beforeEach(() => {
  h.negar = false;
  h.semOrg = false;
  h.filtros = [];
  h.busca = null;
});

describe("GET /admin/agencia-leads", () => {
  it("sem platform admin → 403", async () => {
    h.negar = true;
    expect((await GET(pedido())).status).toBe(403);
  });

  it("lista só os leads da organização ATIVA (do servidor), com contato espelhado", async () => {
    const res = await GET(pedido("q=aur"));
    expect(res.status).toBe(200);
    expect(h.filtros).toContainEqual(["organization_id", "org-agencia"]);
    expect(h.busca).toBe("%aur%");
    expect((await res.json()).data.leads[0]).toEqual({
      id: "l1",
      title: "Aurora",
      status: "won",
      contact_name: "Dra",
      contact_email: "a@b.c",
    });
  });

  it("sem organização ativa devolve lista vazia, sem consultar", async () => {
    h.semOrg = true;
    const j = await (await GET(pedido())).json();
    expect(j.data).toEqual({ agencia: null, leads: [] });
    expect(h.filtros).toEqual([]);
  });
});
