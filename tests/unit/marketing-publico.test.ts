/**
 * A LEITURA PÚBLICA (o link sem login): o que NUNCA pode vazar.
 *
 * Quem abre o link não tem sessão, então `resolverLink` e `paginasPublicadas` rodam com a chave
 * de serviço — nenhuma RLS protege. A proteção é a lógica deste módulo, e é isto que se cerca:
 * token malformado nem toca o banco; link revogado, vencido ou de empresa suspensa é "não existe";
 * só sai conteúdo PUBLICADO, da empresa do link, e no escopo do link.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_PATHS } from "@/lib/auth/public-paths";

interface Chamada {
  tabela: string;
  filtros: Array<[string, unknown]>;
}
const chamadas: Chamada[] = [];
let linhasPorTabela: Record<string, unknown> = {};

/** Um cliente de banco falso, encadeável: registra o que foi consultado e devolve o que o teste preparou. */
function consultaFalsa(tabela: string) {
  const chamada: Chamada = { tabela, filtros: [] };
  chamadas.push(chamada);
  const resultado = () => linhasPorTabela[tabela];
  const q: Record<string, unknown> = {};
  const encadeia =
    (nome: string) =>
    (...args: unknown[]) => {
      chamada.filtros.push([nome, args]);
      return q;
    };
  for (const m of ["select", "eq", "not", "is", "limit", "update"]) q[m] = encadeia(m);
  q.maybeSingle = async () => ({ data: resultado() ?? null });
  q.then = (ok: (v: unknown) => unknown) => ok({ data: resultado() ?? [] });
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: consultaFalsa }) }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));

import { gerarToken } from "@/lib/marketing/links";
import { paginasPublicadas, resolverLink } from "@/lib/marketing/publico";

const ORG = "00000000-0000-4000-8000-000000000001";
const linha = (sobre: Record<string, unknown> = {}) => ({
  id: "l1",
  organization_id: ORG,
  module_key: null,
  expires_at: null,
  revoked_at: null,
  last_used_at: new Date().toISOString(),
  ...sobre,
});

beforeEach(() => {
  chamadas.length = 0;
  linhasPorTabela = { organizations: { status: "active" } };
});

describe("resolverLink", () => {
  it("token com forma inválida: recusa sem consultar o banco", async () => {
    for (const ruim of ["", "curto", "../../etc/passwd", "a b c".repeat(12)]) {
      expect(await resolverLink(ruim)).toBeNull();
    }
    expect(chamadas).toHaveLength(0);
  });

  it("link que não existe: nulo", async () => {
    linhasPorTabela.marketing_share_links = null;
    expect(await resolverLink(gerarToken())).toBeNull();
  });

  it("link vigente da empresa ativa: resolve, com a empresa e o escopo do link", async () => {
    linhasPorTabela.marketing_share_links = linha({ module_key: "onboarding" });
    expect(await resolverLink(gerarToken())).toEqual({
      linkId: "l1",
      organizationId: ORG,
      moduloDoEscopo: "onboarding",
    });
  });

  it("revogado: 'não existe'", async () => {
    linhasPorTabela.marketing_share_links = linha({ revoked_at: "2026-10-01T00:00:00Z" });
    expect(await resolverLink(gerarToken())).toBeNull();
  });

  it("vencido: 'não existe'", async () => {
    linhasPorTabela.marketing_share_links = linha({ expires_at: "2020-01-01T00:00:00Z" });
    expect(await resolverLink(gerarToken())).toBeNull();
  });

  it("empresa suspensa: 'não existe' (o link não revive uma empresa parada)", async () => {
    linhasPorTabela.marketing_share_links = linha();
    linhasPorTabela.organizations = { status: "suspended" };
    expect(await resolverLink(gerarToken())).toBeNull();
  });
});

describe("paginasPublicadas", () => {
  const link = { linkId: "l1", organizationId: ORG, moduloDoEscopo: null as string | null };

  it("consulta SÓ a empresa do link e SÓ o que está publicado (published_blocks não nulo)", async () => {
    linhasPorTabela.marketing_pages = [];
    await paginasPublicadas(link);
    const c = chamadas.find((x) => x.tabela === "marketing_pages")!;
    const nomes = c.filtros.map(([n, a]) => `${n}:${JSON.stringify(a)}`);
    expect(nomes).toContain(`eq:${JSON.stringify(["organization_id", ORG])}`);
    expect(nomes).toContain(`not:${JSON.stringify(["published_blocks", "is", null])}`);
    // Nunca lê rascunho.
    expect(chamadas.some((x) => x.tabela === "marketing_page_drafts")).toBe(false);
  });

  it("link de uma página: filtra por aquele módulo", async () => {
    linhasPorTabela.marketing_pages = [];
    await paginasPublicadas({ ...link, moduloDoEscopo: "onboarding" });
    const c = chamadas.find((x) => x.tabela === "marketing_pages")!;
    expect(c.filtros.map(([n, a]) => `${n}:${JSON.stringify(a)}`)).toContain(
      `eq:${JSON.stringify(["module_key", "onboarding"])}`,
    );
  });

  it("descarta módulo desconhecido e bloco inválido (nunca quebra a página do cliente)", async () => {
    linhasPorTabela.marketing_pages = [
      {
        module_key: "onboarding",
        published_at: "x",
        published_blocks: [{ id: "a", tipo: "texto", texto: "ok" }, { tipo: "lixo" }],
      },
      {
        module_key: "modulo-inventado",
        published_at: "x",
        published_blocks: [{ id: "b", tipo: "texto", texto: "x" }],
      },
    ];
    const r = await paginasPublicadas(link);
    expect(r.map((p) => p.module_key)).toEqual(["onboarding"]);
    expect(r[0]!.blocos).toHaveLength(1);
  });
});

describe("proxy: o que fica público", () => {
  const publico = (caminho: string) => PUBLIC_PATHS.some((re) => re.test(caminho));
  it("só /p/<token> e /p/<token>/<módulo>", () => {
    const tk = gerarToken();
    expect(publico(`/p/${tk}`)).toBe(true);
    expect(publico(`/p/${tk}/onboarding`)).toBe(true);
    expect(publico(`/p/${tk}/onboarding/extra`)).toBe(false);
    expect(publico("/p/curto")).toBe(false);
    expect(publico(`/p/${tk}/img/0b5f2a3e-6c1d-4f7a-9d2e-123456789abc.png`)).toBe(true);
    expect(publico(`/p/${tk}/img/../../x.png`)).toBe(false);
    expect(publico(`/p/${tk}/img/qualquer.svg`)).toBe(false);
    expect(publico("/p/")).toBe(false);
    // As rotas da AGÊNCIA continuam exigindo sessão.
    expect(publico("/api/v1/marketing/share-links")).toBe(false);
    expect(publico("/api/v1/marketing/pages/onboarding")).toBe(false);
    expect(publico("/app/marketing")).toBe(false);
  });
});
