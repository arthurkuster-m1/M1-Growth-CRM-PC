import { beforeEach, describe, expect, it, vi } from "vitest";

const cabecalhos = new Map<string, string>();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => cabecalhos.get(k.toLowerCase()) ?? null }) }));
vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(async () => ({
    ok: true,
    user: { id: "u1", idioma: "pt-BR", is_platform_admin: false, support: null },
    org: { orgId: "11111111-1111-4111-8111-111111111111", role: "admin" },
  })),
}));
const clientes = vi.fn();
vi.mock("@/lib/agencia/acesso", () => ({ clientesDaAgencia: (...a: unknown[]) => clientes(...a) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ tipo: "sessao" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ tipo: "admin" }) }));

import { autorizarCronograma } from "./cronograma-servidor";

const MEU = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  cabecalhos.clear();
  clientes.mockReset();
});

describe("autorizarCronograma no modo agência", () => {
  it("sem header, vale a organização da sessão", async () => {
    const a = await autorizarCronograma("viewer", false);
    expect(a.ok && a.orgId).toBe(MEU);
  });
  it("com header de cliente que a pessoa acessa, usa o cliente (com a sessão, se for membro)", async () => {
    cabecalhos.set("x-agencia-cliente", OUTRO);
    clientes.mockResolvedValue([{ id: OUTRO, name: "Outro", role: "manager" }]);
    const a = await autorizarCronograma("manager", true);
    expect(a.ok && a.orgId).toBe(OUTRO);
    expect(a.ok && (a.supabase as unknown as { tipo: string }).tipo).toBe("sessao");
  });
  it("super-admin sem associação usa o cliente admin", async () => {
    cabecalhos.set("x-agencia-cliente", OUTRO);
    clientes.mockResolvedValue([{ id: OUTRO, name: "Outro", role: "plataforma" }]);
    const a = await autorizarCronograma("manager", true);
    expect(a.ok && (a.supabase as unknown as { tipo: string }).tipo).toBe("admin");
  });
  it("cliente que a pessoa NÃO acessa é recusado (o header não concede nada)", async () => {
    cabecalhos.set("x-agencia-cliente", OUTRO);
    clientes.mockResolvedValue([{ id: MEU, name: "Meu", role: "admin" }]);
    const a = await autorizarCronograma("viewer", false);
    expect(a.ok).toBe(false);
    expect(!a.ok && a.response.status).toBe(403);
  });
  it("id que não é uuid é recusado", async () => {
    cabecalhos.set("x-agencia-cliente", "../etc");
    clientes.mockResolvedValue([]);
    const a = await autorizarCronograma("viewer", false);
    expect(a.ok).toBe(false);
  });
});
