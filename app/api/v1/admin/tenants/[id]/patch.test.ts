import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PATCH /api/v1/admin/tenants/[id] — edição do cadastro da empresa.
 * Cobre: permissão (escrita de platform admin), validação (campo proibido,
 * vazio, formato), 404, escrita filtrada pelo id do CAMINHO e auditoria sem
 * valores.
 */

class Negada extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const h = vi.hoisted(() => ({
  ator: "aaaaaaaa-0000-4000-8000-000000000001",
  negar: null as string | null,
  linha: null as Record<string, unknown> | null,
  erro: null as { message: string } | null,
  atualizacoes: [] as Array<{ valores: unknown; filtro: [string, unknown][] }>,
  audit: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: async () => null }));
vi.mock("@/lib/audit", () => ({ audit: h.audit }));
vi.mock("@/lib/auth/requirePlatformAdmin", async () => {
  const { fail } = await import("@/lib/api/wrappers");
  return {
    requirePlatformAdmin: vi.fn(),
    requirePlatformAdminEscrita: async () => {
      if (h.negar) throw new Negada(h.negar);
      return { user: { id: h.ator, email: "a@m1.com" }, platformAdmin: { scope: "full" } };
    },
    falhaDaEscritaDePlatformAdmin: (err: unknown, requestId?: string) =>
      fail(err instanceof Negada ? err.code : "forbidden", "negado", 403, { requestId }),
  };
});
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: (...args: unknown[]) => h.rpc(...args),
    from: (tabela: string) => {
      expect(tabela).toBe("organizations");
      const registro: { valores: unknown; filtro: [string, unknown][] } = {
        valores: null,
        filtro: [],
      };
      const c: Record<string, unknown> = {};
      c.update = (valores: unknown) => {
        registro.valores = valores;
        h.atualizacoes.push(registro);
        return c;
      };
      c.eq = (col: string, val: unknown) => (registro.filtro.push([col, val]), c);
      c.select = () => c;
      c.maybeSingle = async () => ({ data: h.linha, error: h.erro });
      return c;
    },
  }),
}));

import { PATCH } from "./route";

const TENANT = "bbbbbbbb-0000-4000-8000-000000000001";
const ctx = { params: Promise.resolve({ id: TENANT }) };
const pedido = (body: unknown) =>
  new NextRequest(`http://localhost/api/v1/admin/tenants/${TENANT}`, {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  h.negar = null;
  h.erro = null;
  h.atualizacoes = [];
  h.linha = { id: TENANT, slug: "acme", display_name: "Acme" };
  h.rpc.mockResolvedValue({ data: 1, error: null });
});

describe("PATCH /admin/tenants/[id]", () => {
  it("sem escrita de platform admin → 403 e nada gravado", async () => {
    h.negar = "forbidden_scope";
    const res = await PATCH(pedido({ display_name: "Novo nome" }), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden_scope");
    expect(h.atualizacoes).toEqual([]);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("grava os campos válidos filtrando pelo id do CAMINHO e audita só os nomes", async () => {
    const res = await PATCH(
      pedido({ display_name: "Acme Ltda", cnpj: "", dpo_email: "DPO@Acme.com", country: "BR" }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(h.atualizacoes).toHaveLength(1);
    expect(h.atualizacoes[0]?.filtro).toEqual([["id", TENANT]]);
    expect(h.atualizacoes[0]?.valores).toEqual({
      display_name: "Acme Ltda",
      cnpj: null,
      dpo_email: "dpo@acme.com",
      country: "BR",
    });
    expect(h.audit).toHaveBeenCalledTimes(1);
    const entrada = h.audit.mock.calls[0]?.[0];
    expect(entrada).toMatchObject({
      action: "tenant.updated_by_platform_admin",
      organizationId: TENANT,
      resourceId: TENANT,
      actingAsPlatformAdmin: true,
    });
    expect([...entrada.metadata.fields_changed].sort()).toEqual([
      "cnpj",
      "country",
      "display_name",
      "dpo_email",
    ]);
    expect(JSON.stringify(entrada.metadata)).not.toContain("dpo@acme.com");
  });

  it.each([
    ["slug é só leitura", { slug: "outro" }],
    ["status só pelas rotas de suspender/reativar", { status: "suspended" }],
    ["organization_id do body é ignorado como erro", { organization_id: TENANT }],
    ["corpo vazio", {}],
    ["fuso inválido", { timezone: "Marte/Olimpo" }],
    ["moeda fora de ISO", { currency: "real" }],
    ["país fora de ISO", { country: "BRA" }],
    ["idioma desconhecido", { locale: "klingon" }],
    ["cor da marca inválida", { marca: { app_name: null, accent_hex: "azul" } }],
    ["retenção zero", { media_retention_days: 0 }],
    ["nome curto", { display_name: "A" }],
    ["interface com preset desconhecido", { interface_settings: { preset: "outra" } }],
  ])("%s → 400 sem gravar", async (_nome, corpo) => {
    const res = await PATCH(pedido(corpo), ctx);
    expect(res.status).toBe(400);
    expect(h.atualizacoes).toEqual([]);
  });

  it("JSON inválido → 400", async () => {
    expect((await PATCH(pedido("{nao-json"), ctx)).status).toBe(400);
  });

  it("empresa inexistente → 404 sem audit; erro do banco → 500", async () => {
    h.linha = null;
    expect((await PATCH(pedido({ display_name: "Novo nome" }), ctx)).status).toBe(404);
    expect(h.audit).not.toHaveBeenCalled();
    h.linha = { id: TENANT, slug: "acme", display_name: "Acme" };
    h.erro = { message: "boom" };
    expect((await PATCH(pedido({ display_name: "Novo nome" }), ctx)).status).toBe(500);
  });

  it("só a marca → função definer com o ator, sem UPDATE direto, cor normalizada", async () => {
    const res = await PATCH(pedido({ marca: { app_name: "Acme", accent_hex: "#366D6F" } }), ctx);
    expect(res.status).toBe(200);
    expect(h.atualizacoes).toEqual([]);
    expect(h.rpc).toHaveBeenCalledWith(
      "fn_definir_marca_da_organizacao",
      expect.objectContaining({
        p_org: TENANT,
        p_actor: h.ator,
        p_marca: expect.objectContaining({ app_name: "Acme", accent_hex: "#366d6f" }),
      }),
    );
    expect(h.audit.mock.calls[0]?.[0].metadata.fields_changed).toEqual(["marca"]);
  });

  it("marca null limpa (p_marca null); função que não gravou → 500", async () => {
    expect((await PATCH(pedido({ marca: null }), ctx)).status).toBe(200);
    expect(h.rpc.mock.calls[0]?.[1].p_marca).toBeNull();
    h.rpc.mockResolvedValue({ data: 0, error: null });
    expect((await PATCH(pedido({ marca: null }), ctx)).status).toBe(500);
  });

  it("onboarding.o_que_faz mescla em onboarding_state.welcome sem perder o aceite dos termos", async () => {
    h.linha = {
      id: TENANT,
      slug: "acme",
      display_name: "Acme",
      onboarding_state: {
        welcome: { accepted_at: "2026-11-01T12:00:00Z", o_que_faz: "velho" },
        team: { x: 1 },
      },
    };
    const res = await PATCH(pedido({ onboarding: { o_que_faz: "Clínica nova" } }), ctx);
    expect(res.status).toBe(200);
    expect(h.atualizacoes[0]?.valores).toEqual({
      onboarding_state: {
        welcome: { accepted_at: "2026-11-01T12:00:00Z", o_que_faz: "Clínica nova" },
        team: { x: 1 },
      },
    });
    expect(h.audit.mock.calls[0]?.[0].metadata.fields_changed).toEqual(["onboarding"]);
  });

  it("onboarding.o_que_faz vazio limpa só esse campo; campo estranho no onboarding → 400", async () => {
    h.linha = {
      id: TENANT,
      slug: "acme",
      display_name: "Acme",
      onboarding_state: { welcome: { accepted_at: "t", o_que_faz: "velho" } },
    };
    expect((await PATCH(pedido({ onboarding: { o_que_faz: "" } }), ctx)).status).toBe(200);
    expect(h.atualizacoes[0]?.valores).toEqual({
      onboarding_state: { welcome: { accepted_at: "t" } },
    });
    expect((await PATCH(pedido({ onboarding: { welcome: {} } }), ctx)).status).toBe(400);
  });

  it("finalizar o onboarding grava onboarded_at", async () => {
    const quando = "2026-11-04T18:00:00Z";
    expect((await PATCH(pedido({ onboarded_at: quando }), ctx)).status).toBe(200);
    expect(h.atualizacoes[0]?.valores).toEqual({ onboarded_at: quando });
  });
});
