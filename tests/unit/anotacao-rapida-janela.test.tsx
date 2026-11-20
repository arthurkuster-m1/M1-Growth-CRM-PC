/**
 * O lápis da barra do topo: abre a janela "Anotação rápida", escolhe a página de destino pela busca
 * e envia (Ctrl+Enter). Só a agência (gerente ou mais) vê o lápis.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AnotacaoRapida } from "@/components/anotacoes/AnotacaoRapida";
import type { ResumoDaNota } from "@/lib/anotacoes/paginas";

const nota = (id: string, title: string, kind: "inbox" | null = null): ResumoDaNota => ({
  id,
  parent_id: null,
  title,
  icon: null,
  position: 1,
  visible_to_client: false,
  kind,
  tags: [],
  deleted_at: null,
  updated_at: "2026-11-13T00:00:00Z",
});

const org = { role: "manager" as string };
const post = vi.fn(async () => ({ data: { page_id: "b" } }));

vi.mock("@/hooks/auth/AuthProvider", () => ({ useActiveOrg: () => org }));
vi.mock("@/hooks/anotacoes/useArvoreDeNotas", () => ({
  useArvoreDeNotas: () => ({
    notas: [nota("a", "Caixa de entrada", "inbox"), nota("b", "Reuniões")],
  }),
}));
vi.mock("@/lib/api/client", () => ({
  apiClient: { post: (...a: unknown[]) => post(...(a as [])) },
}));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => undefined;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  org.role = "manager";
});

const ui = () => (
  <QueryClientProvider client={new QueryClient()}>
    <AnotacaoRapida />
  </QueryClientProvider>
);

describe("AnotacaoRapida (lápis)", () => {
  it("sem escolher página, vai para a Caixa de entrada (Ctrl+Enter)", async () => {
    render(ui());
    fireEvent.click(screen.getByTestId("anotacao-rapida"));
    const campo = await screen.findByTestId("anotacao-rapida-texto");
    fireEvent.change(campo, { target: { value: "ligar para o fornecedor" } });
    fireEvent.keyDown(campo, { key: "Enter", ctrlKey: true });
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/v1/anotacoes/captura", {
        texto: "ligar para o fornecedor",
      }),
    );
  });

  it("escolhe a página pela lista e manda o page_id", async () => {
    render(ui());
    fireEvent.click(screen.getByTestId("anotacao-rapida"));
    fireEvent.click(await screen.findByTestId("rapida-destino"));
    fireEvent.change(screen.getByTestId("rapida-busca"), { target: { value: "reuni" } });
    fireEvent.click(screen.getByTestId("rapida-opcao-b"));
    fireEvent.change(screen.getByTestId("anotacao-rapida-texto"), { target: { value: "pauta" } });
    fireEvent.click(screen.getByTestId("anotacao-rapida-enviar"));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/v1/anotacoes/captura", {
        texto: "pauta",
        page_id: "b",
      }),
    );
  });

  it("quem não é da agência não vê o lápis", () => {
    org.role = "viewer";
    render(ui());
    expect(screen.queryByTestId("anotacao-rapida")).toBeNull();
  });
});
