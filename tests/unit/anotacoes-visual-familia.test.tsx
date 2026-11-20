/**
 * A tela de Anotações com o visual do app da Família Kuster: o início é a LISTA de páginas (tabela ou
 * cards), sem menu lateral; clicar abre a página inteira com o botão "← Anotações"; quem só lê não vê
 * os controles de edição. O motor (editor de blocos) está simulado: aqui se confere a casca.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Anotacoes } from "@/components/anotacoes/Anotacoes";
import type { ResumoDaNota } from "@/lib/anotacoes/paginas";

const nota = (
  id: string,
  title: string,
  position: number,
  extra: Partial<ResumoDaNota> = {},
): ResumoDaNota => ({
  id,
  parent_id: null,
  title,
  icon: null,
  position,
  visible_to_client: false,
  kind: null,
  tags: [],
  deleted_at: null,
  updated_at: "2026-11-13T00:00:00Z",
  ...extra,
});

const criar = vi.fn(async () => nota("nova", "", 9));
const mudar = vi.fn(async () => true);
const apagar = vi.fn(async () => true);
const arvore = {
  notas: [] as ResumoDaNota[],
  podeEditar: true,
  carregando: false,
  falhou: false,
  criar,
  apagar,
  mudar,
  restaurar: vi.fn(async () => true),
  apagarDeVez: vi.fn(async () => true),
};
const favoritar = vi.fn();
const estado = {
  carregado: true,
  inicio: null,
  favoritas: [] as string[],
  recentes: [] as string[],
  favoritar,
  registrarAbertura: vi.fn(),
};
const replace = vi.fn();
let pedida: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/app/anotacoes",
  useSearchParams: () => new URLSearchParams(pedida ? { p: pedida } : {}),
}));
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(async () => ({ data: { resultados: [] } })),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));
vi.mock("@/hooks/anotacoes/useArvoreDeNotas", () => ({ useArvoreDeNotas: () => arvore }));
vi.mock("@/hooks/anotacoes/useEstadoDasNotas", () => ({ useEstadoDasNotas: () => estado }));
vi.mock("@/hooks/anotacoes/useVersaoDasNotas", () => ({
  useVersaoDasNotas: () => 0,
}));
vi.mock("@/hooks/anotacoes/useNota", () => ({
  useNota: (id: string) => ({
    pagina: { id, blocks: [] },
    estado: "salvo",
    editar: vi.fn(),
    carregando: false,
    falhou: false,
  }),
}));
vi.mock("@/components/anotacoes/EditorDeNotasCarregavel", () => ({
  EditorDeNotasCarregavel: ({ editavel }: { editavel: boolean }) => (
    <div data-testid="editor">editor {editavel ? "editavel" : "leitura"}</div>
  ),
}));

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Anotacoes descricao="Descrição de teste" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  pedida = null;
  arvore.podeEditar = true;
  estado.favoritas = [];
  arvore.notas = [
    nota("a", "Reuniões", 1, { icon: "📞", tags: ["agência"] }),
    nota("b", "Ideias", 2, { visible_to_client: true }),
    nota("c", "Ata de segunda", 3, { parent_id: "a" }),
  ];
});
afterEach(cleanup);

describe("Anotações — a lista (visual da Família Kuster)", () => {
  it("abre em TABELA, sem menu lateral, com o cabeçalho e só as páginas de cima", () => {
    montar();
    expect(screen.getByRole("heading", { level: 1, name: "Anotações" })).toBeTruthy();
    expect(screen.getByText("Descrição de teste")).toBeTruthy();
    expect(screen.queryByRole("complementary")).toBeNull();
    const tabela = screen.getByTestId("tabela-notas");
    expect(within(tabela).getByText("Reuniões")).toBeTruthy();
    expect(within(tabela).getByText("Ideias")).toBeTruthy();
    // a subpágina só aparece pelo filtro "Subpáginas"
    expect(within(tabela).queryByText("Ata de segunda")).toBeNull();
  });

  it('o filtro "Subpáginas" mostra a subpágina com a mãe na coluna "Dentro de"', () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Subpáginas \(1\)/ }));
    const linha = screen.getByTestId("nota-c");
    expect(within(linha).getByText(/Reuniões/)).toBeTruthy();
  });

  it("alterna para CARDS e lembra a escolha", () => {
    const { unmount } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Cards" }));
    expect(screen.getByTestId("cards-notas")).toBeTruthy();
    expect(screen.queryByTestId("tabela-notas")).toBeNull();
    expect(localStorage.getItem("anotacoes.visao")).toBe("cards");
    unmount();
    montar();
    expect(screen.getByTestId("cards-notas")).toBeTruthy();
  });

  it("o card tem capa em degradê e a pílula da visibilidade", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Cards" }));
    const card = screen.getByTestId("nota-b");
    const capa = card.querySelector<HTMLElement>(".an-card__capa");
    expect(capa?.style.background).toContain("linear-gradient(110deg");
    expect(within(card).getByText("Visível ao cliente")).toBeTruthy();
  });

  it('"Favoritas" filtra pelas favoritas', () => {
    estado.favoritas = ["b"];
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Favoritas/ }));
    const tabela = screen.getByTestId("tabela-notas");
    expect(within(tabela).getByText("Ideias")).toBeTruthy();
    expect(within(tabela).queryByText("Reuniões")).toBeNull();
  });

  it("a busca pelo título filtra e diz quando nada é encontrado", async () => {
    montar();
    fireEvent.change(screen.getByTestId("busca-anotacoes"), { target: { value: "ideia" } });
    expect(within(screen.getByTestId("tabela-notas")).queryByText("Reuniões")).toBeNull();
    fireEvent.change(screen.getByTestId("busca-anotacoes"), { target: { value: "zzzz" } });
    expect(await screen.findByText("Nenhuma página encontrada.")).toBeTruthy();
  });

  it("filtrar por etiqueta mostra só as páginas com ela", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /^agência/ }));
    const tabela = screen.getByTestId("tabela-notas");
    expect(within(tabela).getByText("Reuniões")).toBeTruthy();
    expect(within(tabela).queryByText("Ideias")).toBeNull();
  });

  it("clicar numa página a abre pela URL (?p=)", () => {
    montar();
    fireEvent.click(within(screen.getByTestId("nota-a")).getByText("Reuniões"));
    expect(replace).toHaveBeenCalledWith("/app/anotacoes?p=a", { scroll: false });
  });

  it('"Nova página" cria e abre a nova', async () => {
    montar();
    fireEvent.click(screen.getByTestId("nova-pagina"));
    await waitFor(() => expect(criar).toHaveBeenCalledWith(null));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/app/anotacoes?p=nova", { scroll: false }),
    );
  });

  it("a ⋯ de uma página abre as opções (nova subpágina, mover, visibilidade, lixeira)", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Opções de Reuniões" }));
    const folha = screen.getByRole("dialog", { hidden: true, name: "📞 Reuniões" });
    expect(within(folha).getByText("Nova subpágina")).toBeTruthy();
    expect(within(folha).getByText("Mover para…")).toBeTruthy();
    expect(within(folha).getByText("Mostrar para o cliente")).toBeTruthy();
    fireEvent.click(within(folha).getByTestId("opcao-lixeira"));
    expect(apagar).toHaveBeenCalledWith("a");
  });

  it("quem só lê não vê Nova página, alça de arrastar nem ⋯", () => {
    arvore.podeEditar = false;
    montar();
    expect(screen.queryByTestId("nova-pagina")).toBeNull();
    expect(screen.queryByRole("button", { name: /Opções de/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Arrastar/ })).toBeNull();
    expect(screen.queryByTestId("tabela-notas")).not.toBeNull();
  });

  it("sem páginas: convida a criar a primeira", () => {
    arvore.notas = [];
    montar();
    expect(screen.getByText("Você ainda não tem anotações.")).toBeTruthy();
    expect(screen.getByTestId("nova-pagina-vazio")).toBeTruthy();
  });
});

describe("Anotações — a página aberta (visual da Família Kuster)", () => {
  beforeEach(() => {
    pedida = "c";
  });

  it('abre a página inteira, com o botão "← Anotações", a trilha até ela e o editor', () => {
    montar();
    expect(screen.getByTestId("pagina-aberta")).toBeTruthy();
    expect(screen.queryByTestId("lista-notas")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Caminho" }).textContent).toContain("Reuniões");
    expect((screen.getByTestId("titulo-pagina") as HTMLInputElement).value).toBe("Ata de segunda");
    expect(screen.getByTestId("editor").textContent).toContain("editavel");
    fireEvent.click(screen.getByTestId("voltar-lista"));
    expect(replace).toHaveBeenCalledWith("/app/anotacoes", { scroll: false });
  });

  it("favoritar, e o menu ⋯ com a visibilidade e a lixeira", () => {
    montar();
    fireEvent.click(screen.getByTestId("favoritar"));
    expect(favoritar).toHaveBeenCalledWith("c", true);
    expect(screen.queryByTestId("menu-pagina-itens")).toBeNull();
    fireEvent.click(screen.getByTestId("menu-pagina"));
    const menu = screen.getByTestId("menu-pagina-itens");
    expect(within(menu).getByText("Visível ao cliente")).toBeTruthy();
    fireEvent.click(within(menu).getByTestId("menu-lixeira"));
    expect(apagar).toHaveBeenCalledWith("c");
  });

  it("quem só lê vê a página sem o ⋯, o pontinho e a caixa de título", () => {
    arvore.podeEditar = false;
    montar();
    expect(screen.getByTestId("editor").textContent).toContain("leitura");
    expect(screen.queryByTestId("menu-pagina")).toBeNull();
    expect(screen.queryByTestId("ponto-salvamento")).toBeNull();
    expect(screen.queryByTestId("titulo-pagina")).toBeNull();
  });

  it("uma página com subpáginas mostra os cards delas", () => {
    pedida = "a";
    montar();
    const secao = screen.getByRole("region", { name: "Subpáginas" });
    expect(within(secao).getByTestId("nota-c")).toBeTruthy();
    expect(within(secao).getByTestId("nova-subpagina")).toBeTruthy();
  });
});
