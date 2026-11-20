/**
 * O cartão "Notas" do Início: abre a página fixada, trocar de página fixa a nova (a escolhida por
 * último é a que fica), e o cartão não tem mais a "Captura rápida" (agora é o lápis da barra), e quem não é da agência sem páginas
 * liberadas não vê o cartão.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { NotasDoInicio } from "@/components/anotacoes/NotasDoInicio";
import type { ResumoDaNota } from "@/lib/anotacoes/paginas";

const nota = (id: string, title: string, position: number): ResumoDaNota => ({
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
});

const arvore = {
  notas: [nota("a", "Início", 1), nota("b", "Reuniões", 2)],
  podeEditar: true,
  carregando: false,
  falhou: false,
  criar: vi.fn(),
  apagar: vi.fn(),
  mudar: vi.fn(),
};
const fixarNoInicio = vi.fn();
const estado = { carregado: true, inicio: "a" as string | null, fixarNoInicio };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/anotacoes/useArvoreDeNotas", () => ({ useArvoreDeNotas: () => arvore }));
vi.mock("@/hooks/anotacoes/useEstadoDasNotas", () => ({ useEstadoDasNotas: () => estado }));
vi.mock("@/hooks/anotacoes/useVersaoDasNotas", () => ({ useVersaoDasNotas: () => 0 }));
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

beforeAll(() => {
  // O diálogo (Radix) pede estas pontes ao navegador.
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
  arvore.podeEditar = true;
  arvore.notas = [nota("a", "Início", 1), nota("b", "Reuniões", 2)];
  estado.inicio = "a";
});

describe("NotasDoInicio", () => {
  it("abre a página fixada", () => {
    render(<NotasDoInicio />);
    expect(screen.getByTestId("editor").textContent).toBe("editor editavel");
    expect((screen.getByLabelText("Página das notas") as HTMLSelectElement).value).toBe("a");
  });

  it("trocar de página mostra a nova e a fixa no Início", () => {
    render(<NotasDoInicio />);
    fireEvent.change(screen.getByLabelText("Página das notas"), { target: { value: "b" } });
    expect((screen.getByLabelText("Página das notas") as HTMLSelectElement).value).toBe("b");
    expect(fixarNoInicio).toHaveBeenCalledWith("b");
  });

  it("não tem mais o botão de Captura rápida (virou o lápis da barra)", () => {
    render(<NotasDoInicio />);
    expect(screen.queryByRole("button", { name: /Captura rápida/ })).toBeNull();
  });

  it("sem página escolhida, pede para escolher no seletor", () => {
    estado.inicio = null;
    render(<NotasDoInicio />);
    expect(screen.queryByTestId("editor")).toBeNull();
    expect(screen.getByText(/Escolha no seletor/)).toBeTruthy();
  });

  it("não aparece para quem não edita e não tem página liberada", () => {
    arvore.podeEditar = false;
    arvore.notas = [];
    const { container } = render(<NotasDoInicio />);
    expect(container.textContent).toBe("");
  });
});
