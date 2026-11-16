/** POST /api/v1/marketing/estrategia/ocultas — ocultar, mostrar e apagar páginas da Estratégia. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/v1/marketing/estrategia/ocultas/route";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

const ORG = "22222222-2222-4222-8222-222222222222";

interface Registro {
  apagados: Array<{ filtro: string; valor: string }>;
  ocultos: Array<Record<string, unknown>>;
  desocultados: string[];
}
let reg: Registro;

function supabaseFalso() {
  return {
    from: (tabela: string) => {
      const chain: Record<string, unknown> = {};
      let modo: "delete" | "upsert" | null = null;
      let chaveDoDelete = "";
      Object.assign(chain, {
        delete: () => {
          modo = "delete";
          return chain;
        },
        upsert: (linha: Record<string, unknown>) => {
          reg.ocultos.push(linha);
          return Promise.resolve({ error: null });
        },
        eq: (col: string, v: string) => {
          if (tabela === "marketing_pages" && col === "module_key") {
            reg.apagados.push({ filtro: "eq", valor: v });
          }
          if (tabela === "marketing_estrategia_ocultos" && col === "chave") chaveDoDelete = v;
          if (tabela === "marketing_estrategia_ocultos" && modo === "delete" && col === "chave") {
            return Promise.resolve({ error: null }).then((r) => {
              reg.desocultados.push(chaveDoDelete);
              return r;
            });
          }
          return chain;
        },
        like: (_c: string, v: string) => {
          reg.apagados.push({ filtro: "like", valor: v });
          return chain;
        },
        select: () => Promise.resolve({ data: [{ id: "x" }], error: null }),
      });
      return chain;
    },
  };
}

const pedir = (corpo: unknown) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(corpo) }) as never);

beforeEach(() => {
  vi.clearAllMocks();
  reg = { apagados: [], ocultos: [], desocultados: [] };
  vi.mocked(requireSupportWrite).mockResolvedValue(null);
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: "u1", idioma: "pt-BR" },
    org: { orgId: ORG, role: "manager" },
  } as never);
  vi.mocked(createClient).mockResolvedValue(supabaseFalso() as never);
});

describe("Estratégia: ocultar, mostrar e apagar", () => {
  it("ocultar guarda a chave e NÃO apaga conteúdo", async () => {
    const r = await pedir({ chave: "estudo-de-persona", acao: "ocultar" });
    expect(r.status).toBe(200);
    expect(reg.ocultos[0]).toMatchObject({ organization_id: ORG, chave: "estudo-de-persona" });
    expect(reg.apagados).toEqual([]);
    expect(vi.mocked(audit).mock.calls[0]![0].action).toBe("marketing_estrategia.hidden");
  });

  it("mostrar tira a chave", async () => {
    const r = await pedir({ chave: "fase:diagnostico", acao: "mostrar" });
    expect(r.status).toBe(200);
    expect(reg.desocultados).toEqual(["fase:diagnostico"]);
    expect(vi.mocked(audit).mock.calls[0]![0].action).toBe("marketing_estrategia.shown");
  });

  it("apagar uma página leva a página e as subpáginas (prefixo) e depois oculta", async () => {
    const r = await pedir({ chave: "estudo-de-persona", acao: "apagar" });
    expect(r.status).toBe(200);
    expect(reg.apagados).toEqual([
      { filtro: "eq", valor: "estudo-de-persona" },
      { filtro: "like", valor: "estudo-de-persona--%" },
    ]);
    expect(reg.ocultos[0]).toMatchObject({ chave: "estudo-de-persona" });
    expect(vi.mocked(audit).mock.calls[0]![0].action).toBe("marketing_estrategia.deleted");
  });

  it("apagar a fase 02 NUNCA toca em Produtos e ofertas", async () => {
    await pedir({ chave: "fase:produto-e-oferta", acao: "apagar" });
    const valores = reg.apagados.map((a) => a.valor);
    expect(valores.some((v) => v.startsWith("produtos-e-ofertas"))).toBe(false);
    expect(valores).toContain("estudo-de-persona");
    expect(reg.ocultos[0]).toMatchObject({ chave: "fase:produto-e-oferta" });
  });

  it("Produtos e ofertas não se oculta nem se apaga; atalho não se apaga; chave inventada é recusada", async () => {
    for (const acao of ["ocultar", "apagar", "mostrar"] as const) {
      expect((await pedir({ chave: "produtos-e-ofertas", acao })).status).toBe(422);
    }
    expect((await pedir({ chave: "atalho:estudo-de-persona", acao: "apagar" })).status).toBe(422);
    expect((await pedir({ chave: "atalho:estudo-de-persona", acao: "ocultar" })).status).toBe(200);
    expect((await pedir({ chave: "qualquer-coisa", acao: "ocultar" })).status).toBe(422);
    expect((await pedir({ chave: "fase:diagnostico", acao: "limpar" })).status).toBe(422);
  });

  it("suporte somente leitura e quem não é gerente não mexem", async () => {
    vi.mocked(requireSupportWrite).mockResolvedValueOnce(
      new Response("{}", { status: 403 }) as never,
    );
    expect((await pedir({ chave: "estudo-de-persona", acao: "ocultar" })).status).toBe(403);
    vi.mocked(requireRole).mockResolvedValueOnce({
      ok: false,
      response: new Response("{}", { status: 403 }),
    } as never);
    expect((await pedir({ chave: "estudo-de-persona", acao: "ocultar" })).status).toBe(403);
    expect(reg.ocultos).toEqual([]);
    expect(reg.apagados).toEqual([]);
  });
});
