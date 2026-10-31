// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportarLeadsDoCRM } from "@/components/clientes/ImportarLeadsDoCRM";
import { apiClient } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));

const FUNIL = "11111111-1111-4111-8111-111111111111";

function montar() {
  const aoFechar = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ImportarLeadsDoCRM
        aberto
        aoFechar={aoFechar}
        funis={[{ id: FUNIL, name: "Seletiva" }]}
        etapas={[]}
        funilInicial={FUNIL}
      />
    </QueryClientProvider>,
  );
  return { aoFechar };
}

describe("ImportarLeadsDoCRM", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: FUNIL, settings: { fields: [] } }] });
    vi.mocked(apiClient.post).mockReset();
  });

  it("cola uma tabela do Excel, envia cabeçalho + linhas e fecha quando tudo entra", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        total_linhas: 2,
        contatos_criados: 2,
        contatos_atualizados: 0,
        cards_criados: 0,
        sem_funil: 2,
        erros: [],
        colunas_personalizadas: [],
      },
    });
    const { aoFechar } = montar();

    fireEvent.paste(screen.getByLabelText("Nome 1"), {
      clipboardData: {
        getData: () => "Ana\t11999998888\tana@x.com\nBia\t11988887777\tbia@x.com",
      },
    });
    await waitFor(() => expect(screen.getByText("2 linhas preenchidas")).toBeTruthy());

    fireEvent.click(screen.getByText("Adicionar Leads ao CRM"));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const [url, corpo] = vi.mocked(apiClient.post).mock.calls[0]!;
    expect(url).toBe("/api/v1/clientes/importar");
    const c = corpo as { pipeline_id: string | null; celulas: string[][] };
    // Começa sem funil: os contatos ficam só guardados.
    expect(c.pipeline_id).toBeNull();
    expect(c.celulas[0]![0]).toBe("Nome");
    expect(c.celulas).toHaveLength(3);
    expect(c.celulas[1]!.slice(0, 3)).toEqual(["Ana", "11999998888", "ana@x.com"]);
    await waitFor(() => expect(aoFechar).toHaveBeenCalled());
  });

  it("mostra o que foi recusado, com o número da linha da tabela, e não fecha", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        total_linhas: 1,
        contatos_criados: 1,
        contatos_atualizados: 0,
        cards_criados: 0,
        sem_funil: 1,
        erros: [{ linha: 2, motivo: "telefone não reconhecido" }],
        colunas_personalizadas: [],
      },
    });
    const { aoFechar } = montar();
    fireEvent.change(screen.getByLabelText("Nome 3"), { target: { value: "Carla" } });
    fireEvent.click(screen.getByText("Adicionar Leads ao CRM"));
    await waitFor(() => expect(screen.getByText(/Linha 3: telefone não reconhecido/)).toBeTruthy());
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it("começa com nome, telefone e e-mail; dá para escolher propriedades e a ordem, e envia nessa ordem", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        total_linhas: 1,
        contatos_criados: 1,
        contatos_atualizados: 0,
        cards_criados: 0,
        sem_funil: 1,
        erros: [],
        colunas_personalizadas: ["Idade"],
      },
    });
    montar();
    expect(screen.queryByLabelText("Instagram 1")).toBeNull();
    fireEvent.change(screen.getByLabelText("Nome 1"), { target: { value: "Ana" } });

    fireEvent.click(screen.getByTestId("colunas-da-importacao"));
    fireEvent.click(await screen.findByText("+ Instagram"));
    fireEvent.change(screen.getByLabelText("Nome do novo campo personalizado"), {
      target: { value: "Idade" },
    });
    fireEvent.click(screen.getByText("Criar"));
    // Idade sobe para antes do Instagram.
    fireEvent.click(screen.getByLabelText("Subir Idade"));
    fireEvent.keyDown(document.body, { key: "Escape" });

    await waitFor(() => expect(screen.getByLabelText("Idade 1")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Idade 1"), { target: { value: "35" } });
    fireEvent.change(screen.getByLabelText("Instagram 1"), { target: { value: "https://ig/ana" } });
    fireEvent.click(screen.getByText("Adicionar Leads ao CRM"));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const c = vi.mocked(apiClient.post).mock.calls[0]![1] as { celulas: string[][] };
    expect(c.celulas[0]).toEqual(["Nome", "Telefone", "E-mail", "Idade", "Instagram"]);
    expect(c.celulas[1]).toEqual(["Ana", "", "", "35", "https://ig/ana"]);
  });
});
