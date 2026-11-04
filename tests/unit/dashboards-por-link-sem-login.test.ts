import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolverLink, acessoPermitido, handler } = vi.hoisted(() => ({
  resolverLink: vi.fn(),
  acessoPermitido: vi.fn(),
  handler: vi.fn(async (..._a: unknown[]) => Response.json({ data: { ok: true } })),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/marketing/publico", () => ({
  resolverLink: (t: string) => resolverLink(t),
  acessoPermitido: (ip: string) => acessoPermitido(ip),
  empresaDoLink: async () => ({ nome: "Acme", idioma: "pt-BR" }),
}));
vi.mock("@/app/api/v1/agenda/analises/route", () => ({ GET: handler }));
vi.mock("@/app/api/v1/dashboards/atendimento/route", () => ({ GET: handler }));
vi.mock("@/app/api/v1/dashboards/business/route", () => ({ GET: handler }));
vi.mock("@/app/api/v1/dashboards/prospeccao/route", () => ({ GET: handler }));
vi.mock("@/app/api/v1/dashboards/prospeccao/custos/route", () => ({ GET: handler }));
vi.mock("@/app/api/v1/dashboards/trafego/route", () => ({ GET: handler }));
vi.mock("@/app/api/v1/dashboards/visibilidade/route", () => ({ GET: handler }));
vi.mock("@/app/api/v1/team/assignable/route", () => ({ GET: handler }));
vi.mock("@/app/api/v1/reports/activities/route", () => ({ GET: handler }));
vi.mock("@/app/api/v1/reports/tags/route", () => ({ GET: handler }));

import { GET } from "@/app/p/[token]/dados/[...caminho]/route";
import { PUBLIC_PATHS } from "@/lib/auth/public-paths";
import { painelPublicoAtual, sessaoDoPainelPublico } from "@/lib/dashboards/painel-publico";

const TOKEN = "a".repeat(43);
const chamar = (caminho: string[]) =>
  GET(new Request(`http://x/p/${TOKEN}/dados/${caminho.join("/")}?de=2026-01-01`) as never, {
    params: Promise.resolve({ token: TOKEN, caminho }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  acessoPermitido.mockResolvedValue(true);
});

describe("dashboards pelo link sem login", () => {
  it("link do escopo dashboards: roda o handler dentro do contexto da empresa do LINK", async () => {
    resolverLink.mockResolvedValue({
      linkId: "l",
      organizationId: "org-1",
      moduloDoEscopo: "dashboards",
    });
    let visto: unknown = null;
    handler.mockImplementationOnce(async () => {
      visto = { ctx: painelPublicoAtual(), sessao: sessaoDoPainelPublico() };
      return Response.json({ data: 1 });
    });
    const r = await chamar(["dashboards", "trafego"]);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const v = visto as { ctx: { orgId: string }; sessao: { org: { orgId: string; role: string } } };
    expect(v.ctx.orgId).toBe("org-1");
    expect(v.sessao.org.role).toBe("viewer");
    // fora da rota o contexto não vaza
    expect(painelPublicoAtual()).toBeNull();
  });

  it("link do painel de Marketing (sem escopo) ou de outra página NÃO abre dados", async () => {
    for (const escopo of [null, "cronograma", "diagnostico"]) {
      resolverLink.mockResolvedValue({
        linkId: "l",
        organizationId: "org-1",
        moduloDoEscopo: escopo,
      });
      expect((await chamar(["dashboards", "trafego"])).status).toBe(404);
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("link inexistente, revogado ou vencido responde 404", async () => {
    resolverLink.mockResolvedValue(null);
    expect((await chamar(["dashboards", "business"])).status).toBe(404);
  });

  it("rota fora da lista fechada responde 404, mesmo com link válido", async () => {
    resolverLink.mockResolvedValue({
      linkId: "l",
      organizationId: "org-1",
      moduloDoEscopo: "dashboards",
    });
    for (const c of [
      ["contacts"],
      ["dashboards", "visibilidade", "x"],
      ["marketing", "share-links"],
    ]) {
      expect((await chamar(c)).status).toBe(404);
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("o proxy deixa passar só a forma /p/<token>/dados/<rota>", () => {
    const ok = (p: string) => PUBLIC_PATHS.some((r) => r.test(p));
    expect(ok(`/p/${TOKEN}/dados/dashboards/trafego`)).toBe(true);
    expect(ok(`/p/${TOKEN}/dashboards`)).toBe(true);
    expect(ok(`/api/v1/dashboards/trafego`)).toBe(false);
  });
});
