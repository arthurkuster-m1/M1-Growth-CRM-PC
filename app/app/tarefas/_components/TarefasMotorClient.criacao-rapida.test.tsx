/**
 * CRIAÇÃO RÁPIDA: o campo de baixo da tabela de Tarefas. Clica, escreve, Enter → a tarefa nasce,
 * sem abrir pop-up, e o campo fica pronto para a próxima. "Mais detalhes" abre o painel lateral.
 * Monta o componente de verdade (hooks, cache) com a API simulada, como o teste de "nasce com
 * os filtros".
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Filtro } from "@/lib/motor/consulta";
import type { OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import type { Tarefa } from "@/lib/tarefas/tipos";

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/app/tarefas",
  useSearchParams: () => new URLSearchParams(),
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
const ANA = "11111111-1111-4111-8111-111111111111";
const opcao = (
  id: string,
  name: string,
  grupo: OpcaoDeStatus["grupo"],
  position: number,
): OpcaoDeStatus => ({
  id,
  organization_id: ORG,
  name,
  color: "gray",
  grupo,
  position,
});
const OPCOES = [
  opcao("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Não iniciada", "pending", 1),
  opcao("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Em andamento", "in_progress", 2),
];

/** Agora = 2026-10-09 12:00 em São Paulo. Ontem = 2026-10-08. */
const AGORA_ISO = "2026-10-09T15:00:00.000Z";

let criadas: Array<Record<string, unknown>>;
/** O banco simulado: o que o GET devolve depois de cada POST (o app refaz a leitura ao criar). */
let banco: Tarefa[];

function simularApi(filtros: Filtro[]) {
  criadas = [];
  banco = [];
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url.startsWith("/api/v1/tasks/status-options")) return { data: { options: OPCOES } };
    if (url.startsWith("/api/v1/tasks/properties")) return { data: { properties: [] } };
    if (url.startsWith("/api/v1/tasks/templates")) return { data: { templates: [] } };
    if (url.startsWith("/api/v1/tasks")) return { data: { tasks: banco } };
    if (url.startsWith("/api/v1/view-preferences")) return { data: { config: { filtros } } };
    if (url.startsWith("/api/v1/saved-views")) return { data: { views: [] } };
    if (url.startsWith("/api/v1/team/assignable"))
      return { data: [{ user_id: ANA, role: "agent", full_name: "Ana" }] };
    return { data: {} };
  });
  vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { task: {} } });
  vi.mocked(apiClient.post).mockImplementation(async (url: string, corpo: unknown) => {
    if (!url.startsWith("/api/v1/tasks")) return { data: {} };
    const c = corpo as Record<string, unknown>;
    criadas.push(c);
    const opc = OPCOES.find((o) => o.id === c.status_option_id);
    // O que o servidor devolve: a linha gravada (o trigger do banco põe o `status` do grupo da opção).
    const tarefa: Tarefa = {
      id: `nova-${criadas.length}`,
      organization_id: ORG,
      title: String(c.title),
      description: (c.description as string) ?? null,
      due_date: (c.due_date as string) ?? null,
      start_date: (c.start_date as string) ?? null,
      priority: (c.priority as Tarefa["priority"]) ?? "medium",
      status: opc?.grupo ?? "pending",
      lead_id: null,
      contact_id: null,
      assigned_to: (c.assigned_to as string) ?? null,
      created_by: null,
      created_at: AGORA_ISO,
      updated_at: AGORA_ISO,
      status_option_id: (c.status_option_id as string) ?? null,
      position: Number(c.position ?? 1),
      custom_fields: {},
    };
    banco.push(tarefa);
    return { data: { task: tarefa } };
  });
}

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TarefasMotorClient
        fuso="America/Sao_Paulo"
        usuarioId={ANA}
        podeEditar
        podeConfigurar
        agoraIso={AGORA_ISO}
      />
    </QueryClientProvider>,
  );
}

const f = (campo: string, operador: string, valor?: Filtro["valor"]): Filtro =>
  ({ campo, operador, ...(valor !== undefined ? { valor } : {}) }) as Filtro;

/** O campo de texto do rodapé da tabela (o botão "Nova tarefa" do alto é outro elemento). */
const campoRapido = () => screen.findByRole("textbox", { name: "Nova tarefa" });

describe("Criação rápida — o campo de baixo da tabela", () => {
  beforeEach(() => vi.clearAllMocks());

  it("escrever e dar Enter cria a tarefa, sem abrir pop-up; o campo esvazia e mantém o foco", async () => {
    simularApi([]);
    montar();
    const campo = await campoRapido();
    await userEvent.click(campo);
    await userEvent.type(campo, "Ligar para o cliente{Enter}");

    await waitFor(() => expect(criadas).toHaveLength(1), { timeout: 4000 });
    expect(criadas[0]).toMatchObject({
      title: "Ligar para o cliente",
      status_option_id: OPCOES[0]!.id,
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((campo as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(campo);
  });

  it("várias seguidas: uma tarefa por Enter, cada uma depois da anterior", async () => {
    simularApi([]);
    montar();
    const campo = await campoRapido();
    await userEvent.type(campo, "Primeira{Enter}Segunda{Enter}Terceira{Enter}");

    await waitFor(() => expect(criadas).toHaveLength(3), { timeout: 4000 });
    expect(criadas.map((c) => c.title)).toEqual(["Primeira", "Segunda", "Terceira"]);
    const posicoes = criadas.map((c) => Number(c.position));
    expect(posicoes[1]!).toBeGreaterThan(posicoes[0]!);
    expect(posicoes[2]!).toBeGreaterThan(posicoes[1]!);
  });

  it("Enter em campo vazio ou só com espaços não cria nada", async () => {
    simularApi([]);
    montar();
    const campo = await campoRapido();
    await userEvent.type(campo, "{Enter}   {Enter}");
    await new Promise((r) => setTimeout(r, 200));
    expect(criadas).toHaveLength(0);
  });

  it("a tarefa nasce com o que a tela pede (filtro de prioridade)", async () => {
    simularApi([f("prioridade", "e", ["high"])]);
    montar();
    const campo = await campoRapido();
    await userEvent.type(campo, "Revisar proposta{Enter}");
    await waitFor(() => expect(criadas).toHaveLength(1), { timeout: 4000 });
    expect(criadas[0]).toMatchObject({ title: "Revisar proposta", priority: "high" });
  });

  it("Esc limpa o campo sem criar", async () => {
    simularApi([]);
    montar();
    const campo = await campoRapido();
    await userEvent.type(campo, "Desisti{Escape}");
    expect((campo as HTMLInputElement).value).toBe("");
    expect(criadas).toHaveLength(0);
  });

  it("se o servidor recusar, o texto volta para o campo", async () => {
    simularApi([]);
    montar();
    const campo = await campoRapido();
    const ok = vi.mocked(apiClient.post).getMockImplementation()!;
    vi.mocked(apiClient.post).mockImplementation(async (url: string, corpo: unknown) => {
      if (url.startsWith("/api/v1/tasks")) throw new Error("falhou");
      return ok(url, corpo);
    });
    await userEvent.type(campo, "Não vai gravar{Enter}");
    await waitFor(() => expect((campo as HTMLInputElement).value).toBe("Não vai gravar"), {
      timeout: 4000,
    });
    expect(criadas).toHaveLength(0);
  });

  it('"Mais detalhes" abre o painel lateral já com o título digitado, sem criar ainda', async () => {
    simularApi([]);
    montar();
    const campo = await campoRapido();
    await userEvent.type(campo, "Planejar o trimestre");
    await userEvent.click(screen.getByRole("button", { name: /Mais detalhes/ }));

    const titulo = await screen.findByRole("textbox", { name: "Título da tarefa" });
    expect((titulo as HTMLInputElement).value).toBe("Planejar o trimestre");
    expect(criadas).toHaveLength(0);
    expect((campo as HTMLInputElement).value).toBe("");

    await userEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));
    await waitFor(() => expect(criadas).toHaveLength(1), { timeout: 4000 });
    expect(criadas[0]).toMatchObject({ title: "Planejar o trimestre" });
  });
});
