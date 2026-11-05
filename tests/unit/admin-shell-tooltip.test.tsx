/**
 * A casca do /admin provê o `TooltipProvider`. O que estes testes protegem:
 *
 *  - tela nova renderizada DENTRO da casca nasce funcionando, sem precisar
 *    lembrar do Provider — e nos dois valores de `userEmail` que o call site
 *    real pode entregar, porque ele passa `user.email ?? ""`;
 *  - o segundo caso prova que a exigência é do Radix, não do teste: sem ele o
 *    primeiro passaria mesmo que nada estivesse sendo exigido.
 *
 * Por que merece catraca: sem um Provider ANCESTRAL o `Tooltip` do Radix lança
 * no cliente e o React derruba a árvore inteira — não é um tooltip sem estilo,
 * é a tela inteira sumindo. Como não existe `app/admin/error.tsx`, quem captura
 * é o boundary da RAIZ (`app/error.tsx` → `components/feedback/SegmentError.tsx`),
 * então some junto a casca: o dono vê "Algo deu errado" e um ID. Rastro existe,
 * mas não onde se procura primeiro — o throw é do cliente, então não há linha no
 * log do servidor Next; quem recebe é o Sentry, que numa instalação padrão é o
 * da comunidade (`SENTRY_DSN` vazio no `.env.example` cai no `DEFAULT_SENTRY_DSN`).
 * Com `SENTRY_DSN=off` não sobra rastro nenhum.
 *
 * Quem é atingido, e quem não é — está medido em `components/admin/AdminShell.tsx`
 * e não é repetido aqui. Dois pontos de lá que mudam como se lê um vermelho:
 * o consumidor sem Provider próprio é o `TenantBadge`, montado em /admin/inbox,
 * /admin/inbox/[conversationId], /admin/lgpd e /admin/lgpd/requests/[id]; e
 * /admin/usage NÃO está na lista, apesar do nome colidir, porque os gráficos de
 * lá importam um `Tooltip` do recharts, que não usa Provider nenhum.
 *
 * LIMITE DECLARADO — o que estes testes NÃO guardam: o elo entre a casca e as
 * telas. Quem monta a casca é `app/admin/(protected)/layout.tsx`, e se ele
 * deixar de usar o `AdminShell` as 4 telas quebram de novo com estes casos
 * verdes. Pelo mesmo motivo, "tela nova" acima quer dizer tela sob
 * `app/admin/(protected)`: o `app/admin/layout.tsx` é passthrough deliberado, e
 * `app/admin/forbidden` já renderiza fora da casca hoje. Guardar esse elo
 * exigiria montar um layout async que chama `requirePlatformAdmin`; o teste
 * frágil que sairia daí vale menos que esta frase precisa.
 *
 * Sabotagem que confirma que a guarda vigia: remover o `<TooltipProvider>` de
 * `AdminShell.tsx` deixa o primeiro caso vermelho, nos dois valores de e-mail.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { AdminShell } from "@/components/admin/AdminShell";
import { ThemeProvider } from "@/lib/theme";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// A casca sob teste é a casca de verdade, não uma maquete dela; só o menu e a barra de cima
// (que dependem do usuário logado) são trocados abaixo. Mesmo padrão de `tests/unit/sidebar-grupos.test.tsx`.
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/inbox",
}));
// Desde 04/11/2026 a casca do admin usa o menu e a barra de cima DO APP, que leem usuário,
// organização ativa e busca. Eles não são o objeto aqui (o Provider de tooltip é): stubs.
vi.mock("@/components/shell/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("@/components/shell/TopBar", () => ({ TopBar: () => null }));
vi.mock("@/components/agencia/SeletorDeClientes", () => ({
  SeletorDeClientes: ({ clientes }: { clientes: unknown[] }) => (
    <div data-testid="seletor-de-clientes">{clientes.length} clientes</div>
  ),
}));
vi.mock("@/components/shell/BarraDeProgressoNavegacao", () => ({
  BarraDeProgressoNavegacao: () => null,
}));

// O `ThemeProvider` lê `matchMedia` para resolver o tema "system", e o jsdom
// não implementa. Mesmo stub local de `lib/theme.test.tsx` — não há helper
// compartilhado no repo, e inventar um terceiro padrão aqui seria pior.
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as unknown as typeof window.matchMedia;

/** Consumidor sem Provider próprio, como o `TenantBadge`. */
function UsaTooltipSemProviderProprio() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button">gatilho</button>
      </TooltipTrigger>
      <TooltipContent>dica</TooltipContent>
    </Tooltip>
  );
}

afterEach(cleanup);

describe("AdminShell", () => {
  // Os dois valores que `app/admin/(protected)/layout.tsx:7` pode passar:
  // `user.email ?? ""`. Sem o caso vazio, uma casca que condicionasse o
  // Provider ao e-mail passaria verde e quebraria para quem não tem e-mail.
  it.each([
    ["e-mail preenchido", "dono@exemplo.com"],
    ["e-mail vazio, como em user.email ?? ''", ""],
  ])(
    "provê o TooltipProvider aos filhos com %s — tela nova nasce funcionando",
    (_rotulo, userEmail) => {
      // O `<ThemeProvider>` NÃO é maquete: ele repõe aqui o que o layout RAIZ
      // (`app/layout.tsx:294`) envolve em torno de toda a árvore, admin
      // inclusive. Passou a ser necessário quando a tarja do Modo Plataforma
      // ganhou o `ThemeToggle` — até então o admin era a única superfície sem
      // forma de trocar de tema. Sem esta linha o teste mediria uma casca que
      // não existe em produção: montada fora dos providers da raiz.
      expect(() =>
        render(
          <ThemeProvider>
            <AdminShell sidebarCollapsed={userEmail === ""}>
              <UsaTooltipSemProviderProprio />
            </AdminShell>
          </ThemeProvider>,
        ),
      ).not.toThrow();

      expect(screen.getByRole("button", { name: "gatilho" })).toBeInTheDocument();
    },
  );

  it("o mesmo filho SEM a casca lança — prova que a guarda vem do AdminShell", () => {
    // Com a mensagem fixada: `.toThrow()` sozinho aceita QUALQUER lançamento, e
    // aí um import quebrado no stand-in manteria o verde enquanto o caso
    // deixaria de provar que a exigência é do Radix.
    expect(() => render(<UsaTooltipSemProviderProprio />)).toThrow(
      /must be used within `TooltipProvider`/,
    );
  });

  it("mostra o seletor de empresas do Modo agência quando há clientes, e some sem eles", () => {
    const um = [{ id: "a", name: "Acme", cor: "#366d6f" }];
    const { rerender } = render(
      <ThemeProvider>
        <AdminShell sidebarCollapsed={false} clientes={um} selecionados={[]}>
          <p>conteúdo</p>
        </AdminShell>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("seletor-de-clientes")).toHaveTextContent("1 clientes");
    rerender(
      <ThemeProvider>
        <AdminShell sidebarCollapsed={false}>
          <p>conteúdo</p>
        </AdminShell>
      </ThemeProvider>,
    );
    expect(screen.queryByTestId("seletor-de-clientes")).toBeNull();
  });
});
