import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LoteDaCampanha } from "@/lib/marketing/lotes";

import { LotesDaCampanha } from "./LotesDaCampanha";

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }));

afterEach(() => {
  cleanup();
  get.mockReset();
});

const base: LoteDaCampanha = {
  id: "x",
  tipo: "extracao",
  em: "2026-10-20T15:00:00.000Z",
  termos: "clínicas de estética",
  cidade: "Curitiba, PR",
  limite: 300,
  custo_usd: 1.5,
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

  it("sem nenhum lote, diz o que fazer", async () => {
    mostrar([]);
    await waitFor(() => expect(screen.getByText(/Nada por aqui ainda/)).toBeInTheDocument());
  });
});
