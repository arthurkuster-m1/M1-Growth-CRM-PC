// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AtendimentoDoLead } from "@/components/contacts/ficha/AtendimentoDoLead";
import { PainelDaVisaoGeral } from "@/components/contacts/ficha/PainelDaVisaoGeral";
import { apiClient } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));

const ID = "11111111-1111-4111-8111-111111111111";

/** As respostas NA FORMA REAL das rotas (a de tarefas devolve `{ data: { tasks } }`). */
function responder(url: string) {
  if (url.startsWith("/api/v1/tasks")) {
    return {
      data: {
        tasks: [
          {
            id: "t1",
            title: "Ligar de volta",
            due_date: "2020-01-01T10:00:00.000Z",
            priority: "high",
            status: "pending",
            assigned_to: null,
          },
        ],
      },
    };
  }
  if (url.startsWith("/api/v1/vendas")) {
    return {
      data: {
        vendas: [
          {
            id: "v1",
            product_name: "Plano Plus",
            amount_cents: 100000,
            status: "comprometida",
            expected_on: "2026-12-01",
            parcelas: [{ number: 1, due_on: "2026-12-01", paid_on: null, amount_cents: 100000, status: "prevista" }],
          },
        ],
      },
    };
  }
  if (url.includes("/anotacoes")) {
    return {
      data: [{ id: "n1", titulo: "Preferência", texto: "Prefere contato à noite", fixada: true, criada_em: "2026-10-01T10:00:00.000Z" }],
    };
  }
  if (url.includes("/qualificacao")) {
    return { data: { entrou_em: "2026-10-01T10:00:00.000Z", primeira_abordagem: null, primeira_compra: null, is_mql: true, mql_at: null, funis: [] } };
  }
  if (url.startsWith("/api/v1/team")) return { data: [] };
  return { data: [] };
}

function montar(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Visão geral e Atendimento leem as rotas na forma real", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => responder(url) as never);
  });

  it("a Visão geral mostra venda, tarefa e anotação sem quebrar", async () => {
    montar(<PainelDaVisaoGeral contactId={ID} aoAbrir={() => {}} />);
    await waitFor(() => expect(screen.getByText("Ligar de volta")).toBeTruthy());
    expect(screen.getByText("Plano Plus")).toBeTruthy();
    expect(screen.getByText("Prefere contato à noite")).toBeTruthy();
  });

  it("o Atendimento lista a tarefa pendente", async () => {
    montar(<AtendimentoDoLead contactId={ID} />);
    await waitFor(() => expect(screen.getByText("Ligar de volta")).toBeTruthy());
  });

  it("rota de tarefas fora do ar não derruba a tela", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url.startsWith("/api/v1/tasks")) throw new Error("500");
      return responder(url) as never;
    });
    montar(<PainelDaVisaoGeral contactId={ID} aoAbrir={() => {}} />);
    await waitFor(() => expect(screen.getByText("Nenhuma tarefa pendente.")).toBeTruthy());
  });
});
