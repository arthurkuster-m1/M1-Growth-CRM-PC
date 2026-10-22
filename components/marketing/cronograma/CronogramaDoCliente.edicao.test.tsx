/**
 * A EDIÇÃO NO PRÓPRIO CRONOGRAMA: "Editar" põe os botões "+ Nova meta / fase / ação" onde elas
 * ficam, e clicar numa meta, fase ou ação abre as configurações ao lado.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useActiveOrg: () => ({ name: "Clínica Teste" }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import { limparDesfazer, iniciarDesfazer } from "@/lib/motor/desfazer";
import { CronogramaDoCliente } from "./CronogramaDoCliente";

const item = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  acao: "Montar a página",
  semana_inicio: 1,
  semana_fim: 2,
  status: "planejado",
  destaque: false,
  notas: "",
  fase: "Estruturação",
  arquivado: false,
  ordem: 10,
  ...over,
});
const meta = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  titulo: "Faturamento",
  tipo: "moeda",
  unidade: "",
  valor_alvo: 10000,
  valor_atual: null,
  descricao: "",
  ordem: 10,
  fonte: "manual",
  periodo: "mes",
  periodo_de: null,
  periodo_ate: null,
  calculo: "soma",
  ...over,
});

let itens: ReturnType<typeof item>[];
let metas: ReturnType<typeof meta>[];

function simular() {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url.includes("/semana")) return { data: { inicio: "2026-10-18", tarefas: [] } };
    return {
      data: {
        config: {
          total_semanas: 8,
          data_inicio: "2026-10-18",
          subtitulo_geral: "",
          subtitulo_semana: "",
        },
        itens,
        metas,
        pode_editar: true,
      },
    };
  });
}

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CronogramaDoCliente />
    </QueryClientProvider>,
  );
}

describe("cronograma — edição no próprio painel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limparDesfazer();
    itens = [item()];
    metas = [meta()];
    simular();
  });

  it("só aparecem os botões de criar depois de clicar em Editar", async () => {
    montar();
    await screen.findByText("Montar a página");
    expect(screen.queryByRole("button", { name: /Nova meta/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("button", { name: /\+ Nova meta/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /\+ Nova fase/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /\+ Nova ação/ }).length).toBeGreaterThan(0);
  });

  it("clicar numa ação abre as configurações dela; a edição vai ao servidor", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: { item: item({ acao: "Página pronta" }) },
    });
    montar();
    await screen.findByText("Montar a página");
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const linha = screen.getByText("Montar a página").closest("[data-editavel]") as HTMLElement;
    await userEvent.click(linha);
    const gaveta = await screen.findByRole("complementary", { name: "Ação-chave" });
    const campo = within(gaveta).getByLabelText("Ação") as HTMLInputElement;
    expect(campo.value).toBe("Montar a página");
    fireEvent.change(campo, { target: { value: "Página pronta" } });
    fireEvent.blur(campo);
    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/marketing/cronograma/itens/i1", {
        acao: "Página pronta",
      }),
    );
  });

  it("+ Nova meta cria na hora e abre a meta nova; Ctrl+Z desfaz a criação", async () => {
    vi.mocked(apiClient.post).mockImplementation(async () => {
      metas = [...metas, meta({ id: "m2", titulo: "Nova meta", valor_alvo: null, tipo: "numero" })];
      return { data: { meta: metas[1] } };
    });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { deleted: true } });
    montar();
    await screen.findByText("Montar a página");
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await userEvent.click(screen.getByRole("button", { name: /\+ Nova meta/ }));
    const gaveta = await screen.findByRole("complementary", { name: "Meta" });
    expect((within(gaveta).getByLabelText("Meta") as HTMLInputElement).value).toBe("Nova meta");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/marketing/cronograma/metas",
      expect.objectContaining({ titulo: "Nova meta" }),
    );
    // o Ctrl+Z do app desfaz a criação
    const r = iniciarDesfazer();
    expect(r).not.toBeNull();
    await r!.concluido;
    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/marketing/cronograma/metas/m2");
  });

  it("+ Nova fase cria a primeira ação da fase e abre a fase para dar o nome", async () => {
    vi.mocked(apiClient.post).mockImplementation(async (_url: string, corpo: unknown) => {
      const novo = item({ id: "i2", ...(corpo as object), ordem: 20 });
      itens = [...itens, novo];
      return { data: { item: novo } };
    });
    montar();
    await screen.findByText("Montar a página");
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await userEvent.click(screen.getByRole("button", { name: /\+ Nova fase/ }));
    const gaveta = await screen.findByRole("complementary", { name: "Fase" });
    expect((within(gaveta).getByLabelText("Nome da fase") as HTMLInputElement).value).toBe(
      "Nova fase",
    );
  });

  it("fora do modo de edição nada é clicável e a gaveta não existe", async () => {
    montar();
    await screen.findByText("Montar a página");
    expect(document.querySelector("[data-editavel]")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});
