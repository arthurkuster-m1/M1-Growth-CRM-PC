import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(async () => ({})),
  patch: vi.fn(async () => ({})),
}));
vi.mock("@/lib/api/client", () => ({ apiClient: api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import { AtalhosDaOportunidade } from "./AtalhosDaOportunidade";

function montar(extra: Partial<React.ComponentProps<typeof AtalhosDaOportunidade>> = {}) {
  api.get.mockResolvedValue({
    data: { campanhas: [], campaign_id: null, source: "whatsapp", tags: [] },
  });
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AtalhosDaOportunidade
        leadId="lead-1"
        podeEditar
        proximaAcao="Ligar na quinta"
        proximaAcaoEm="2026-10-30"
        previsao="2026-11-15"
        aoSalvar={() => undefined}
        {...extra}
      />
    </QueryClientProvider>,
  );
}

describe("atalhos da oportunidade no compromisso", () => {
  it("mostra a próxima ação, a data e a previsão que a oportunidade já tem", () => {
    montar();
    expect((screen.getByLabelText("Próxima ação") as HTMLInputElement).value).toBe(
      "Ligar na quinta",
    );
    expect((screen.getByLabelText("Data da próxima ação") as HTMLInputElement).value).toBe(
      "2026-10-30",
    );
    expect((screen.getByLabelText("Previsão de fechamento") as HTMLInputElement).value).toBe(
      "2026-11-15",
    );
  });

  it("editar a próxima ação grava pela rota da oportunidade ao sair do campo", async () => {
    montar();
    const campo = screen.getByLabelText("Próxima ação");
    fireEvent.change(campo, { target: { value: "Enviar proposta" } });
    fireEvent.blur(campo);
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/api/v1/leads/lead-1/proxima-acao", {
        proxima_acao: "Enviar proposta",
      }),
    );
  });

  it("mudar a previsão de fechamento grava no lead", async () => {
    montar();
    fireEvent.change(screen.getByLabelText("Previsão de fechamento"), {
      target: { value: "2026-12-01" },
    });
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/api/v1/leads/lead-1", {
        expected_close_date: "2026-12-01",
      }),
    );
  });

  it("a origem fica num toggle fechado, com o resumo na linha", async () => {
    montar();
    const toggle = await screen.findByTestId("origem-da-oportunidade");
    expect((toggle as HTMLDetailsElement).open).toBe(false);
    expect(toggle.textContent).toContain("whatsapp");
  });

  it("sem permissão de editar, os campos ficam travados", () => {
    montar({ podeEditar: false });
    expect((screen.getByLabelText("Próxima ação") as HTMLInputElement).disabled).toBe(true);
  });
});
