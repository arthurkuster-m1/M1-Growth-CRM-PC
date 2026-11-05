import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  negar: false,
  orgs: [] as Array<Record<string, unknown>>,
  resumo: [] as Array<Record<string, unknown>>,
  rpc: vi.fn(),
  filtroIds: null as string[] | null,
  rpcErro: null as { code: string } | null,
}));

vi.mock("@/lib/auth/requirePlatformAdmin", () => ({
  requirePlatformAdmin: async () => {
    if (h.negar) throw new Error("no");
    return { user: { id: "u" } };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabela: string) => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.order = () => c;
      c.limit = () => c;
      c.in = (_col: string, ids: string[]) => {
        if (tabela === "organizations") h.filtroIds = ids;
        return c;
      };
      c.then = (ok: (r: unknown) => unknown) =>
        Promise.resolve({
          data: tabela === "organizations" ? h.orgs : [{ id: "lead1", title: "Acme (cliente)" }],
          error: null,
        }).then(ok);
      return c;
    },
    rpc: (...a: unknown[]) => {
      h.rpc(...a);
      return Promise.resolve(
        h.rpcErro ? { data: null, error: h.rpcErro } : { data: h.resumo, error: null },
      );
    },
  }),
}));

import { GET } from "./route";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const pedido = (qs: string) =>
  new NextRequest(`http://localhost/api/v1/admin/tenants/resumo?${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
  h.negar = false;
  h.filtroIds = null;
  h.rpcErro = null;
  h.orgs = [
    {
      id: A,
      slug: "acme",
      display_name: "Acme",
      legal_name: null,
      cnpj: null,
      status: "active",
      onboarded_at: null,
      created_at: "2026-01-02T10:00:00Z",
      agencia_lead_id: "lead1",
      cor_agencia: null,
      cor_marca: "#366d6f",
    },
  ];
  h.resumo = [
    {
      organization_id: A,
      usuarios_ativos: 2,
      campanhas_ativas: 1,
      investimento_cents: "10000",
      leads: 5,
      vendas: 1,
      faturamento_cents: "50000",
      entrada: "2026-01-03",
      mensalidade: "pendente",
      proximo_pagamento: "2026-11-10",
    },
  ];
});

describe("GET /admin/tenants/resumo", () => {
  it("sem platform admin → 403", async () => {
    h.negar = true;
    expect((await GET(pedido("de=2026-10-01&ate=2026-10-31"))).status).toBe(403);
  });

  it("datas ausentes, mal formadas ou invertidas, ou ids que não são uuid → 400", async () => {
    expect((await GET(pedido(""))).status).toBe(400);
    expect((await GET(pedido("de=2026-10-31&ate=2026-10-01"))).status).toBe(400);
    expect((await GET(pedido("de=ontem&ate=hoje"))).status).toBe(400);
    expect((await GET(pedido("de=2026-10-01&ate=2026-10-31&ids=abc"))).status).toBe(400);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("junta cadastro, números do período e o lead da agência; onboarding é derivado", async () => {
    const res = await GET(pedido("de=2026-10-01&ate=2026-10-31"));
    expect(res.status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith("fn_resumo_das_empresas", {
      p_ids: [],
      p_de: "2026-10-01",
      p_ate: "2026-10-31",
    });
    const [linha] = (await res.json()).data.linhas;
    expect(linha).toMatchObject({
      id: A,
      nome: "Acme",
      situacao: "onboarding",
      cor: "#366d6f",
      usuarios_ativos: 2,
      investimento_cents: 10000,
      faturamento_cents: 50000,
      mensalidade: "pendente",
      proximo_pagamento: "2026-11-10",
      lead_titulo: "Acme (cliente)",
    });
  });

  it("ids do seletor recortam a consulta e a função", async () => {
    await GET(pedido(`de=2026-10-01&ate=2026-10-31&ids=${A}`));
    expect(h.filtroIds).toEqual([A]);
    expect(h.rpc.mock.calls[0]?.[1].p_ids).toEqual([A]);
  });

  it("função da migration 0684 ainda ausente: a lista abre zerada e avisa, sem 500", async () => {
    h.rpcErro = { code: "42883" };
    const res = await GET(pedido("de=2026-10-01&ate=2026-10-31"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.migracao_pendente).toBe(true);
    expect(j.data.linhas[0]).toMatchObject({
      nome: "Acme",
      usuarios_ativos: 0,
      faturamento_cents: 0,
    });
  });
});
