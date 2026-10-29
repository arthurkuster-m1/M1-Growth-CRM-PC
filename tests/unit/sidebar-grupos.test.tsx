/**
 * Sidebar agrupado por objetivo. O que estes testes protegem:
 *
 *  - a hierarquia existe (o usuário reclamou de 17 itens no mesmo peso visual);
 *  - Funis é alcançável sem passar por Configurações — o achado que originou tudo;
 *  - agrupar não criou cabeçalho órfão (grupo cujos filhos a permissão filtrou);
 *  - colapsado não renderiza título nenhum: 6 rótulos em 64px seria ilegível.
 *
 * A regra de quem-vê-o-quê é do registro e está coberta em
 * `navegacao-registry.test.ts`; aqui é a superfície.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Sidebar } from "@/components/shell/Sidebar";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";

const authRef: { user: Pick<AuthUser, "is_platform_admin">; activeOrg: ActiveOrg | null } = {
  user: { is_platform_admin: false },
  activeOrg: null,
};

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => authRef,
  usePermission: () => false,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/inbox",
}));
vi.mock("@/components/connections/ConnectionHealthDot", () => ({
  ConnectionHealthDot: () => null,
}));
// Os contadores leem pelo React Query; aqui não há provider, e o NÚMERO não é
// o objeto destes casos (mora em contador-de-casos/contador-da-fila.test.tsx).
// O dublê desenha um marcador vazio: o que se mede aqui é ONDE o Sidebar o põe.
vi.mock("@/components/shell/ContadorDeCasos", () => ({
  ContadorDeCasos: ({ compacto }: { compacto: boolean }) => (
    <span data-testid="marcador-casos" data-compacto={String(compacto)} />
  ),
}));
vi.mock("@/components/shell/ContadorDaFila", () => ({
  ContadorDaFila: ({ compacto }: { compacto: boolean }) => (
    <span data-testid="marcador-fila" data-compacto={String(compacto)} />
  ),
}));
vi.mock("@/app/actions/shell/toggleSidebar", () => ({
  toggleSidebar: vi.fn(),
}));
// Busca a versão via react-query; sem QueryClientProvider ele lança, e o
// rodapé de versão não é o que estes testes examinam.
vi.mock("@/components/shell/VersionFooter", () => ({
  VersionFooter: () => null,
}));

function comoPapel(role: ActiveOrg["role"]) {
  authRef.user = { is_platform_admin: false };
  authRef.activeOrg = { orgId: "org-1", name: "Org", role };
}

// A preferência de grupo aberto/fechado vive no localStorage, que sobrevive entre casos do mesmo arquivo.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/**
 * Visual M1: sem preferência salva, só o grupo da rota atual começa aberto. Os casos que
 * medem ONDE cada porta mora abrem todos os grupos antes, como o usuário faria clicando.
 */
function abrirTodosOsGrupos() {
  for (const botao of screen.queryAllByRole("button", { expanded: false })) fireEvent.click(botao);
}

describe("Sidebar agrupado", () => {
  it("renderiza os títulos de grupo na ordem de uso", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    const titulos = screen
      .getAllByRole("heading")
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    // Organização não tem título aqui: seu hub (Configurações) vive no rodapé
    // fixo, fora da área que rola — medido, ele caía fora da dobra até em 1080px.
    // Só o Marketing é toggle: Inbox, Agenda, CRM, Tarefas e Financeiro são links soltos, e
    // "Agentes de IA" é UM link para a página "Ver tudo em IA".
    expect(titulos).toEqual(["Marketing"]);
  });

  it("a ordem do menu: Início, Inbox, Agenda, CRM, Tarefas, Financeiro, Marketing, Agentes de IA, Conexões", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const hrefs = [...nav.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    const posicao = (h: string) => hrefs.indexOf(h);
    const ordem = [
      "/app/inicio",
      "/app/inbox",
      "/app/agenda",
      "/app/clientes",
      "/app/tarefas",
      "/app/financas",
    ].map(posicao);
    expect(ordem.every((i) => i >= 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    // Automações mora dentro do toggle de Marketing, e depois dele vêm IA e Conexões.
    const auto = posicao("/app/automacoes");
    expect(auto).toBeGreaterThan(ordem[5]!);
    expect(posicao("/app/ai")).toBeGreaterThan(auto);
    expect(hrefs[hrefs.length - 1]).toBe("/app/connections");
    expect(posicao("/app/connections")).toBeGreaterThan(posicao("/app/ai"));
  });

  it("Agentes de IA é um link só, e as telas de IA não aparecem soltas no menu", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    expect(screen.getByRole("link", { name: "Agentes de IA" })).toHaveAttribute("href", "/app/ai");
    expect(screen.queryByRole("link", { name: /Ver tudo em IA/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Casos" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Agente de IA/ })).toBeNull();
  });

  it("o CRM não é grupo: é a página CRM, solta no topo, e não há hub", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    expect(screen.queryByRole("link", { name: /Ver tudo em CRM/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /CRM/ })).toBeNull();
    expect(screen.getByRole("link", { name: "CRM" })).toHaveAttribute("href", "/app/clientes");
    expect(screen.queryByRole("link", { name: "Etapas do funil" })).toBeNull();
  });

  it("o número de Casos mora em Agentes de IA, e o da Fila no item de Inbox", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    const casos = screen.getAllByTestId("marcador-casos");
    const fila = screen.getAllByTestId("marcador-fila");
    expect(casos).toHaveLength(1);
    expect(fila).toHaveLength(1);
    expect(casos[0]!.closest("a")).toHaveAttribute("href", "/app/ai");
    expect(fila[0]!.closest("a")).toHaveAttribute("href", "/app/inbox");
    // Roteadores saiu do menu para Casos caber (a folga era menos de uma linha).
    expect(screen.queryByRole("link", { name: "Roteadores" })).toBeNull();
    cleanup();
    // Recolhido, o contador vira ponto — é o componente que decide, com esta dica.
    render(<Sidebar collapsed />);
    expect(screen.getByTestId("marcador-casos")).toHaveAttribute("data-compacto", "true");
  });

  it("e os dois itens de funil não disputam o mesmo nome", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    // O CRM do dia a dia é "CRM"; a lista de funis fica no hub do grupo.
    expect(screen.getByRole("link", { name: "CRM" })).toHaveAttribute("href", "/app/clientes");
    expect(screen.queryByRole("link", { name: "Funis" })).toBeNull();
  });

  it("Análise e Audit Log saíram do menu — e Nuvemshop ficou de fora, por escolha", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    // O grupo Análise acabou (outubro/2026): os números vivem nos Dashboards, e o Audit Log deixou de
    // ser tela do cliente (a agência o lê em /admin/audit). Nenhum dos dois volta ao menu do cliente.
    expect(screen.queryByRole("link", { name: /Ver tudo em Análise/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Audit Log/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Honorários/ })).toBeNull();

    // NUVEMSHOP SAIU, e esta linha é a reversão explícita de uma decisão que
    // este mesmo teste travava: a integração tinha sido "desenterrada" para o
    // menu justamente por não ter link nenhum. O dono do produto pediu para
    // ocultá-la — não usa a integração —, então o que era garantia virou o
    // contrário, e fica dito aqui para ninguém "consertar" de volta sem saber.
    //
    // Some do MENU, não do produto: a rota e a página seguem de pé e o ⌘K
    // continua achando (`searchable()` filtra por papel, nunca por `sidebar`).
    expect(screen.queryByRole("link", { name: /Nuvemshop/ })).toBeNull();
  });

  it("Configurações fica no rodapé, nunca dependendo de scroll", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    const config = screen.getByRole("link", { name: /Configurações/ });
    expect(config).toHaveAttribute("href", "/app/settings");
    // Fora da <nav> que rola.
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(nav.contains(config)).toBe(false);
  });

  it("Conexões é uma porta solta, a última do menu, e Webhooks não tem porta própria", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    expect(screen.queryAllByRole("heading").map((h) => h.textContent?.trim())).not.toContain(
      "Canais",
    );
    expect(screen.queryByRole("link", { name: /Webhooks/ })).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const links = [...nav.querySelectorAll("a")];
    expect(links[links.length - 1]).toHaveAttribute("href", "/app/connections");
  });

  it("não deixa cabeçalho órfão quando a permissão esvazia o grupo", () => {
    // Canais acabou como grupo, mas Conexões (admin) não aparece para quem não é admin.
    comoPapel("agent");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    const titulos = screen.getAllByRole("heading").map((el) => el.textContent?.trim());
    expect(titulos).not.toContain("Canais");
    expect(screen.getByRole("link", { name: "Inbox" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Conexões" })).toBeNull();
  });

  it("colapsado esconde os títulos mas mantém os links", () => {
    comoPapel("admin");
    render(<Sidebar collapsed />);
    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    expect(screen.getByRole("link", { name: /Inbox/ })).toBeTruthy();
  });

  it("marca a rota atual com aria-current", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    abrirTodosOsGrupos();
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "CRM" })).not.toHaveAttribute("aria-current");
  });

  it("o toggle de Marketing começa fechado fora das telas dele e abre com um clique", () => {
    comoPapel("admin");
    render(<Sidebar collapsed={false} />);
    // A rota é /app/inbox, que não é do Marketing: o toggle está fechado.
    expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /Marketing/, expanded: false }));
    expect(screen.getByRole("button", { name: /Marketing/, expanded: true })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Automações" })).toHaveAttribute(
      "href",
      "/app/automacoes",
    );
  });
});
