import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConversationHeader } from "@/components/inbox/ConversationHeader";

/**
 * CATRACA: o header do inbox não pode voltar a travar a largura da tela.
 *
 * ## O defeito, medido
 *
 * A barra de ações deste header era `shrink-0`. Como ela não encolhia nem
 * quebrava, o `min-content` do header inteiro era **707px** — e a coluna do
 * meio do inbox é `1fr`, que é `minmax(auto, 1fr)` e não encolhe abaixo do
 * conteúdo. Resultado: o painel de CRM ficava **311px fora da viewport em
 * 1280px**. Em uma resolução de trabalho comum, o atendente não via contexto
 * nenhum do cliente.
 *
 * ## Por que este teste é o que é (e o que ele NÃO é)
 *
 * Este teste olha CLASSE, não pixel — e isso é uma limitação declarada, não um
 * descuido: `min-content`, quebra de flex e resolução de grid são cálculo de
 * layout, e o jsdom não tem engine de layout. Medir largura aqui devolveria
 * zero em tudo e passaria feliz: verde por ausência de motor.
 *
 * A medição de verdade é `tests/sonda-inbox-cabe-na-tela.ts`, que roda num
 * browser e afere as 5 larguras. Esta catraca existe porque aquela sonda não
 * roda no CI, e a regressão específica — alguém devolver `shrink-0` à barra de
 * ações "para os botões não quebrarem" — é textual e barata de pegar.
 *
 * Se um dia o CI ganhar um passo de browser, este arquivo pode morrer em favor
 * da sonda. Enquanto isso, ele é a única coisa entre a regressão e a main.
 */

vi.mock("@/hooks/inbox/useClaimConversation", () => ({
  useClaimConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useCloseConversation", () => ({
  useCloseConversation: () => ({ mutate: vi.fn(), isPending: false }),
  useReopenConversation: () => ({ mutate: vi.fn(), isPending: false }),
  // O header passou a importar `useArchiveConversation` do MESMO módulo (issue
  // #923). Um dublê fechado que não acompanha a nova exportação não falha com
  // "faltou mock": falha com "useArchiveConversation is not a function", que
  // não fala nada do que este arquivo vigia.
  useArchiveConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useReleaseConversation", () => ({
  useReleaseConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));
// O nome do módulo importa: a primeira versão deste arquivo mockava
// "useResumeAi", que NÃO EXISTE — o real é `useResumeAiAttendance`. O teste
// passou assim mesmo (o hook verdadeiro rodou sob o provider), ou seja, o mock
// não mockava nada e ninguém era avisado. Mock de caminho inexistente é ruído
// que parece cobertura.
vi.mock("@/hooks/inbox/useResumeAiAttendance", () => ({
  useResumeAiAttendance: () => ({ mutate: vi.fn(), isPending: false }),
}));
// O header monta o discador (`DialButton`), que exige o `VoiceCallProvider` do
// shell autenticado. Aqui só a largura importa: o discador fica fora da conta.
vi.mock("@/components/voice/DialButton", () => ({ DialButton: () => null }));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  usePermission: () => true,
  useAuth: () => ({ user: { id: "u-1" }, activeOrg: { orgId: "org-1", role: "manager" } }),
}));

const conversation = {
  id: "cv-1",
  organization_id: "org-1",
  contact_id: "ct-1",
  status: "open",
  assigned_to_user_id: null,
  assignee_kind: "ai",
  snooze_until: null,
  tags: [],
  contacts: { id: "ct-1", display_name: "Fulana", name: null, phone_number: "5511999" },
} as unknown as React.ComponentProps<typeof ConversationHeader>["conversation"];

function renderHeader(conv = conversation) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConversationHeader conversation={conv} />
    </QueryClientProvider>,
  );
}

async function abrirOpcoes() {
  await userEvent.click(screen.getByRole("button", { name: "Opções" }));
}

describe("header do inbox — limpo, e sem travar a largura da tela", () => {
  it("só o essencial fica à vista; a identidade encolhe (min-w-0) e as ações moram em Opções", () => {
    const { container } = renderHeader();
    const header = container.firstElementChild as HTMLElement;
    // Guarda de vacuidade: sem header renderizado, as asserções abaixo passariam por não haver o
    // que verificar.
    expect(header, "o header não renderizou").toBeTruthy();
    const identidade = header.children[0] as HTMLElement;
    expect(identidade.className, "a identidade não encolhe: o header volta a travar a largura").toContain(
      "min-w-0",
    );
    // À vista: Assumir e Opções. O resto (Transferir, Fechar…) só aparece com o menu aberto.
    expect(screen.getByRole("button", { name: "Opções" })).toBeTruthy();
    expect(screen.getByText("Assumir")).toBeTruthy();
    expect(screen.queryByText("Transferir")).toBeNull();
    expect(screen.queryByText("Fechar")).toBeNull();
  });

  it("as ações continuam TODAS acessíveis — dentro de Opções", async () => {
    renderHeader();
    await abrirOpcoes();
    for (const rotulo of ["Transferir", "Fechar"]) {
      expect(screen.getByText(rotulo), `a ação "${rotulo}" sumiu das Opções`).toBeTruthy();
    }
  });

  it("com o selo do automático, a ação continua em Opções e o selo fica fora do menu (#1625)", async () => {
    renderHeader({
      ...conversation,
      assigned_to_user_id: "u-1",
      assigned_to_user_name: "Eu",
      assignee_kind: "user",
      bot_silenced_until: new Date(Date.now() + 10 * 60_000).toISOString(),
    } as typeof conversation);

    const selo = screen.getByTestId("badge-atendimento-humano");
    expect(selo.textContent).toBe("Automático volta em instantes");

    await abrirOpcoes();
    for (const rotulo of ["Liberar", "Devolver ao automático", "Transferir", "Lembrar", "Fechar", "Arquivar"]) {
      expect(screen.getByText(rotulo), `a ação "${rotulo}" saiu das Opções`).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Mais ações" })).toBeNull();
  });

  it('"Ver contato" existe no menu e só se cala onde há outra porta', async () => {
    renderHeader();
    await abrirOpcoes();
    // Ele NÃO sai do markup: some por CSS a partir de `xl`, exatamente a largura em que o painel
    // lateral entra na tela com um "Ver contato" próprio.
    const link = screen.getByText("Ver contato").closest("a, button") as HTMLElement;
    expect(link, "o link para o contato sumiu do markup").toBeTruthy();
    expect(link.className, "sem `xl:hidden`, a duplicata volta").toContain("xl:hidden");
  });
});
