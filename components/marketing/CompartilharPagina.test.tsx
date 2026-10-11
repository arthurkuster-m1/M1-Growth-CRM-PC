import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LinkDeMarketing } from "@/lib/marketing/links";

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import { CompartilharPagina } from "./CompartilharPagina";

const TOKEN = "T".repeat(43);
const link = (sobre: Partial<LinkDeMarketing> = {}): LinkDeMarketing => ({
  id: "l1",
  module_key: "mapeamento-do-funil",
  token: TOKEN,
  expires_at: null,
  revoked_at: null,
  created_at: "2026-10-09T10:00:00Z",
  last_used_at: null,
  ...sobre,
});

function montar(temPublicado = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CompartilharPagina
        aberto
        aoFechar={() => {}}
        chave="mapeamento-do-funil"
        temPublicado={temPublicado}
      />
    </QueryClientProvider>,
  );
}

describe("Compartilhar com o cliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { links: [link()] } });
  });

  it("lista o link ativo com o endereço /p/<token>", async () => {
    montar();
    const campo = (await screen.findByLabelText("Endereço do link")) as HTMLInputElement;
    expect(campo.value).toContain(`/p/${TOKEN}`);
    // A lista diz QUAL página é o link (e não só "Só esta página").
    expect(screen.getByText("Mapeamento do funil atual")).toBeTruthy();
  });

  it("gera um link de uma página, com validade, e ele aparece na lista", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { link: link({ id: "l2", token: "N".repeat(43), expires_at: "2099-01-01T00:00:00Z" }) },
    });
    montar();
    await screen.findByLabelText("Endereço do link");
    await userEvent.selectOptions(screen.getByLabelText("Validade"), "30");
    await userEvent.click(screen.getByRole("button", { name: "Gerar link" }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/marketing/share-links", {
        module_key: "mapeamento-do-funil",
        expires_in_days: 30,
      }),
    );
    await waitFor(() => expect(screen.getAllByLabelText("Endereço do link")).toHaveLength(2));
  });

  it("'Painel inteiro' gera link sem módulo", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { link: link({ id: "l3", module_key: null }) },
    });
    montar();
    await screen.findByLabelText("Endereço do link");
    await userEvent.click(screen.getByRole("radio", { name: "Painel inteiro" }));
    await userEvent.click(screen.getByRole("button", { name: "Gerar link" }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/marketing/share-links", {
        module_key: null,
        expires_in_days: null,
      }),
    );
  });

  it("revogar chama a rota e tira o link da lista", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { revoked: true } });
    montar();
    await screen.findByLabelText("Endereço do link");
    await userEvent.click(screen.getByRole("button", { name: "Revogar link" }));
    await waitFor(() =>
      expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/marketing/share-links/l1"),
    );
    await waitFor(() => expect(screen.queryByLabelText("Endereço do link")).toBeNull());
    expect(screen.getByText("Nenhum link ativo.")).toBeTruthy();
  });

  it("link vencido ou revogado não aparece como ativo", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        links: [
          link({ id: "v", expires_at: "2020-01-01T00:00:00Z" }),
          link({ id: "r", revoked_at: "2026-10-01T00:00:00Z" }),
        ],
      },
    });
    montar();
    expect(await screen.findByText("Nenhum link ativo.")).toBeTruthy();
  });

  it("avisa quando a página ainda não foi publicada", async () => {
    montar(false);
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/ainda não foi publicada/)).toBeTruthy();
  });
});
