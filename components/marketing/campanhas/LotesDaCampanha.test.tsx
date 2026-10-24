import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LoteDaCampanha } from "@/lib/marketing/lotes";

import { LotesDaCampanha } from "./LotesDaCampanha";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));
let papel = "admin";
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => ({ activeOrg: { role: papel } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  get.mockReset();
  post.mockReset();
  papel = "admin";
});

const base: LoteDaCampanha = {
  id: "x",
  tipo: "extracao",
  em: "2026-10-20T15:00:00.000Z",
  termos: "clínicas de estética",
  cidade: "Curitiba, PR",
  limite: 300,
  custo_usd: 1.5,
  teto_usd: 5,
  estado: "succeeded",
  modo: "volume",
  novos: 240,
  repetidos: 20,
  invalidos: 0,
  linhas: null,
};

function mostrar(lotes: LoteDaCampanha[]) {
  get.mockResolvedValue({ data: lotes });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <LotesDaCampanha campanhaId="c1" />
    </QueryClientProvider>,
  );
}

describe("LotesDaCampanha", () => {
  it("mostra extrações e importações com data, termos, cidade e resultado", async () => {
    mostrar([
      base,
      {
        ...base,
        id: "y",
        tipo: "importacao",
        em: "2026-10-19T12:00:00.000Z",
        termos: "base-antiga.csv",
        cidade: null,
        custo_usd: null,
        teto_usd: null,
        estado: null,
        modo: null,
        novos: 95,
        repetidos: 20,
        invalidos: 5,
        linhas: 120,
      },
    ]);
    await waitFor(() => expect(screen.getByText("clínicas de estética")).toBeInTheDocument());
    expect(screen.getByText("Curitiba, PR")).toBeInTheDocument();
    expect(screen.getByText("Extração · volume")).toBeInTheDocument();
    expect(
      screen.getByText(/260 encontradas · 240 novas · 20 repetidas ou descartadas/),
    ).toBeInTheDocument();
    expect(screen.getByText("US$ 1,50")).toBeInTheDocument();
    expect(screen.getByText("base-antiga.csv")).toBeInTheDocument();
    expect(
      screen.getByText(/120 linhas · 95 negócios criados · 20 já no CRM · 5 recusadas/),
    ).toBeInTheDocument();
  });

  it("repetir: confirma com o rendimento da última rodada e roda a mesma extração de novo", async () => {
    post.mockResolvedValue({ data: {} });
    // 5 novas de 100 encontradas: a busca está esgotada, e a confirmação avisa.
    mostrar([{ ...base, novos: 5, repetidos: 95 }]);
    const botao = await screen.findByRole("button", { name: /Repetir/ });
    fireEvent.click(botao);
    expect(await screen.findByText(/5% eram novas/)).toBeInTheDocument();
    expect(screen.getByText(/repetir tende a pagar por pouco/)).toBeInTheDocument();
    expect(screen.getByText(/Gasto máximo: US\$ 5,00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Repetir extração" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![1]).toMatchObject({ action: "repeat_search", id: "x" });
    expect(typeof (post.mock.calls[0]![1] as { request_id: string }).request_id).toBe("string");
  });

  it("cancelar a confirmação não roda nada; sem ser admin nem aparece o botão; busca rodando também não", async () => {
    mostrar([base]);
    fireEvent.click(await screen.findByRole("button", { name: /Repetir/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(post).not.toHaveBeenCalled();
    cleanup();

    papel = "manager";
    mostrar([base]);
    await screen.findByText("clínicas de estética");
    expect(screen.queryByRole("button", { name: /Repetir/ })).toBeNull();
    cleanup();

    papel = "admin";
    mostrar([{ ...base, estado: "running" }]);
    await screen.findByText("clínicas de estética");
    expect(screen.queryByRole("button", { name: /Repetir/ })).toBeNull();
  });

  it("sem nenhum lote, diz o que fazer", async () => {
    mostrar([]);
    await waitFor(() => expect(screen.getByText(/Nada por aqui ainda/)).toBeInTheDocument());
  });
});
