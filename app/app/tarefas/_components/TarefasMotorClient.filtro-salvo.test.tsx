/**
 * O FILTRO SALVO é o padrão da visualização (como no Notion): mexer no filtro é um rascunho, "Reset"
 * volta ao salvo, "Salvar" grava o rascunho como novo padrão — e não existe "Limpar tudo".
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/app/tarefas",
  useSearchParams: () => new URLSearchParams("v=v1"),
}));

import { apiClient } from "@/lib/api/client";
import { TarefasMotorClient } from "./TarefasMotorClient";

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia =
  window.matchMedia ??
  (((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia);

const ORG = "00000000-0000-4000-8000-000000000001";
const VISAO = {
  id: "v1",
  organization_id: ORG,
  screen_key: "tarefas",
  name: "Até hoje",
  type: "tabela",
  position: 5,
  editavel: true,
  config: { filtros: [{ campo: "prazo", operador: "ate", valor: "hoje" }] },
};

function simular() {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url.startsWith("/api/v1/tasks/status-options")) return { data: { options: [] } };
    if (url.startsWith("/api/v1/tasks/properties")) return { data: { properties: [] } };
    if (url.startsWith("/api/v1/tasks/templates")) return { data: { templates: [] } };
    if (url.startsWith("/api/v1/tasks")) return { data: { tasks: [] } };
    if (url.startsWith("/api/v1/view-preferences")) return { data: { config: {} } };
    if (url.startsWith("/api/v1/saved-views")) return { data: { views: [VISAO] } };
    if (url.startsWith("/api/v1/team/assignable")) return { data: [] };
    return { data: {} };
  });
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { view: VISAO } });
  vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
}

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TarefasMotorClient
        fuso="America/Sao_Paulo"
        usuarioId="u"
        podeEditar
        podeConfigurar
        agoraIso="2026-10-09T15:00:00.000Z"
      />
    </QueryClientProvider>,
  );
}

async function removerOFiltro() {
  await waitFor(() =>
    expect(within(screen.getByRole("button", { name: /Filtrar/ })).getByText("1")).toBeTruthy(),
  );
  await userEvent.click(screen.getByRole("button", { name: /Filtrar/ }));
  await userEvent.click(await screen.findByRole("button", { name: "Remover filtro" }));
  await userEvent.keyboard("{Escape}");
}

describe("filtro salvo da visualização", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simular();
  });

  it("a visualização abre com o filtro salvo e sem Reset, Salvar ou Limpar tudo", async () => {
    montar();
    await waitFor(() =>
      expect(within(screen.getByRole("button", { name: /Filtrar/ })).getByText("1")).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Limpar tudo" })).toBeNull();
  });

  it("tirar o filtro é um rascunho: nada é gravado e o Reset traz o salvo de volta", async () => {
    montar();
    await removerOFiltro();
    expect(await screen.findByRole("button", { name: "Reset" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Limpar tudo" })).toBeNull();
    expect(within(screen.getByRole("button", { name: /Filtrar/ })).queryByText("1")).toBeNull();
    await new Promise((r) => setTimeout(r, 900));
    expect(apiClient.patch).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() =>
      expect(within(screen.getByRole("button", { name: /Filtrar/ })).getByText("1")).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });

  it("Salvar grava o rascunho como o novo padrão da visualização", async () => {
    montar();
    await removerOFiltro();
    await userEvent.click(await screen.findByRole("button", { name: "Salvar" }));
    await waitFor(
      () =>
        expect(apiClient.patch).toHaveBeenCalledWith(
          "/api/v1/saved-views/v1",
          expect.objectContaining({
            config: expect.not.objectContaining({ filtros: expect.anything() }),
          }),
        ),
      { timeout: 3000 },
    );
    // salvo: já não há o que resetar
    await waitFor(() => expect(screen.queryByRole("button", { name: "Reset" })).toBeNull());
  });
});
