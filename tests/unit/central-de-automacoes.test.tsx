// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FluxoVertical } from "@/components/automacoes/FluxoVertical";
import { apiClient } from "@/lib/api/client";
import { RulesTab } from "@/app/app/webhooks/_components/RulesTab";

vi.mock("@/lib/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));

const regra = (id: string, name: string, trigger_event: string, actions: unknown[]) => ({
  id,
  organization_id: "o",
  name,
  trigger_event,
  conditions: [],
  actions,
  trigger_config: null,
  is_active: true,
  last_run_at: null,
  run_count: 0,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  last_change_actor_kind: null,
  last_change_at: null,
});

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <RulesTab />
    </QueryClientProvider>,
  );
}

describe("Central de Automações", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url.includes("followup-flows")) {
        return {
          data: [
            {
              id: "f1",
              name: "Anti No-Show da reunião",
              status: "active",
              active_version_id: null,
              handoff_policy: "pause",
              updated_at: "2026-11-01T00:00:00Z",
            },
            {
              id: "f2",
              name: "Retomar lead frio",
              status: "draft",
              active_version_id: null,
              handoff_policy: "pause",
              updated_at: "2026-11-01T00:00:00Z",
            },
          ],
        };
      }
      return {
        data: [
          regra("r1", "Faltou: ligar", "appointment.no_show", [
            {
              type: "create_task",
              config: {
                titulo: "Ligar",
                vence_em_dias: 0,
                atribuir_a: "dono_do_lead",
                prioridade: "high",
              },
            },
          ]),
          regra("r2", "Lead novo", "lead.created", [
            { type: "add_tag", config: { tags: ["novo"] } },
          ]),
        ],
      };
    });
  });

  it("filtra por categoria, com contagem, juntando regras e follow-ups", async () => {
    montar();
    await screen.findByText("Faltou: ligar");
    expect(screen.getByText("Todas (4)")).toBeTruthy();
    expect(screen.getByText("Agenda e no-show (2)")).toBeTruthy();
    fireEvent.click(screen.getByText("Agenda e no-show (2)"));
    expect(screen.getByText("Faltou: ligar")).toBeTruthy();
    expect(screen.queryByText("Lead novo")).toBeNull();
    expect(screen.getByText("Anti No-Show da reunião")).toBeTruthy();
    expect(screen.queryByText("Retomar lead frio")).toBeNull();
  });

  it("mostra a regra como fluxo (Quando → Então)", async () => {
    montar();
    await screen.findByText("Faltou: ligar");
    fireEvent.click(screen.getAllByText("Ver como fluxo")[0]!);
    await waitFor(() => expect(screen.getByTestId("fluxo-vertical")).toBeTruthy());
    expect(screen.getByText("Quando")).toBeTruthy();
    expect(screen.getByText("Então")).toBeTruthy();
  });
});

describe("FluxoVertical", () => {
  it("desenha um cartão por passo", () => {
    render(
      <FluxoVertical
        passos={[
          { tipo: "gatilho", titulo: "Quando faltar" },
          { tipo: "condicao", titulo: "Só se Tags contém “vip”" },
          { tipo: "acao", titulo: "Criar tarefa", detalhe: "Ligar" },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
