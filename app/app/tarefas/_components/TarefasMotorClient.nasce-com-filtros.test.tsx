/**
 * A TELA DE TAREFAS, DE PONTA A PONTA: com filtros ligados, criar uma tarefa produz uma
 * tarefa que PASSA nos filtros — e que, portanto, aparece na tabela.
 *
 * O teste de matriz (`tests/unit/tarefa-nasce-com-os-filtros.test.ts`) cerca a regra pura.
 * Este monta o componente de verdade (os hooks, o cache, o botão "Nova tarefa") com a API
 * simulada, porque o defeito que o Arthur relatou — "criei com filtro e a tarefa não
 * apareceu" — pode estar na COLA entre a regra e a tela, e só um teste que clica no botão a vê.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
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

import { toast } from "sonner";

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

async function criarTarefaComFiltros(filtros: Filtro[]) {
  simularApi(filtros);
  montar();
  // Espera os dados carregarem (o botão existe desde o início; a tabela só depois).
  await screen
    .findByText(/Nenhuma tarefa|Sem título|teste/i, undefined, { timeout: 4000 })
    .catch(() => {});
  const botoes = await screen.findAllByRole("button", { name: "Nova tarefa" });
  await userEvent.click(botoes[0]!);
  await waitFor(() => expect(criadas.length).toBe(1), { timeout: 4000 });
  return criadas[0]!;
}

const f = (campo: string, operador: string, valor?: Filtro["valor"]): Filtro =>
  ({ campo, operador, ...(valor !== undefined ? { valor } : {}) }) as Filtro;

describe("Nova tarefa com filtros ligados — o que é enviado ao servidor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Prazo antes de hoje → nasce com prazo de ONTEM", async () => {
    const corpo = await criarTarefaComFiltros([f("prazo", "antes", "hoje")]);
    expect(corpo.due_date).toBe("2026-10-08T03:00:00.000Z");
  });

  it("Início antes de hoje → nasce com início de ONTEM", async () => {
    const corpo = await criarTarefaComFiltros([f("inicio", "antes", "hoje")]);
    expect(corpo.start_date).toBe("2026-10-08T03:00:00.000Z");
  });

  it("Prazo é hoje → nasce com prazo de HOJE", async () => {
    const corpo = await criarTarefaComFiltros([f("prazo", "e", "hoje")]);
    expect(corpo.due_date).toBe("2026-10-09T03:00:00.000Z");
  });

  it("Nome contém + Prioridade é → nasce com o nome e a prioridade", async () => {
    const corpo = await criarTarefaComFiltros([
      f("titulo", "contem", "teste"),
      f("prioridade", "e", ["high"]),
    ]);
    expect(corpo.title).toBe("teste");
    expect(corpo.priority).toBe("high");
  });

  it("a tarefa criada APARECE na tabela (passa nos filtros)", async () => {
    await criarTarefaComFiltros([f("titulo", "contem", "teste"), f("prioridade", "e", ["high"])]);
    const tabela = await screen.findByRole("table", { name: "Tarefas" });
    await new Promise((r) => setTimeout(r, 1500));
    // eslint-disable-next-line no-console
    console.log(
      "TABELA>>",
      tabela.textContent,
      "| linhas:",
      within(tabela).queryAllByRole("row").length,
    );
    await waitFor(() => expect(within(tabela).getByText("teste")).toBeTruthy(), { timeout: 4000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// Do jeito que a PESSOA faz: abre o Filtrar, monta o filtro clicando e só então cria.
// ─────────────────────────────────────────────────────────────────────────────────────────
async function adicionarFiltroPelaTela(passos: {
  campo: string;
  condicao: string;
  valor?: { texto?: string; hoje?: boolean; opcao?: string };
}) {
  const painel = () => screen.getByRole("dialog");
  await userEvent.click(screen.getByRole("button", { name: /Filtrar/ }));
  await userEvent.click(await screen.findByRole("button", { name: "Adicionar filtro" }));
  const campos = await screen.findAllByLabelText("Campo do filtro");
  const ultimo = campos.length - 1;
  await userEvent.selectOptions(campos[ultimo]!, passos.campo);
  const condicoes = screen.getAllByLabelText("Condição do filtro");
  await userEvent.selectOptions(condicoes[ultimo]!, passos.condicao);
  if (passos.valor?.hoje) {
    await userEvent.click(within(painel()).getByRole("button", { name: "Hoje" }));
  }
  if (passos.valor?.texto !== undefined) {
    const valores = screen.getAllByLabelText("Valor do filtro");
    await userEvent.type(valores[valores.length - 1]!, passos.valor.texto);
  }
  if (passos.valor?.opcao) {
    const valores = screen.getAllByLabelText("Valor do filtro");
    await userEvent.selectOptions(valores[valores.length - 1]!, passos.valor.opcao);
  }
  await userEvent.keyboard("{Escape}");
}

async function montarEClicarEmNovaTarefa(
  filtrosPelaTela: Array<Parameters<typeof adicionarFiltroPelaTela>[0]>,
) {
  simularApi([]);
  montar();
  await screen.findAllByRole("button", { name: "Nova tarefa" });
  for (const filtro of filtrosPelaTela) await adicionarFiltroPelaTela(filtro);
  const botoes = screen.getAllByRole("button", { name: "Nova tarefa" });
  await userEvent.click(botoes[0]!);
  await waitFor(() => expect(criadas.length).toBe(1), { timeout: 4000 });
  return criadas[0]!;
}

describe("montando o filtro PELA TELA e criando a tarefa", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Prazo antes de hoje", async () => {
    const corpo = await montarEClicarEmNovaTarefa([
      { campo: "Prazo", condicao: "antes de", valor: { hoje: true } },
    ]);
    expect(corpo.due_date).toBe("2026-10-08T03:00:00.000Z");
  });

  it("Início antes de hoje", async () => {
    const corpo = await montarEClicarEmNovaTarefa([
      { campo: "Início", condicao: "antes de", valor: { hoje: true } },
    ]);
    expect(corpo.start_date).toBe("2026-10-08T03:00:00.000Z");
  });

  it("Nome contém + Prioridade é", async () => {
    const corpo = await montarEClicarEmNovaTarefa([
      { campo: "Título", condicao: "contém", valor: { texto: "teste" } },
      { campo: "Prioridade", condicao: "é", valor: { opcao: "Alta" } },
    ]);
    expect(corpo.title).toBe("teste");
    expect(corpo.priority).toBe("high");
  });
});

describe("GARANTIA: a tarefa criada sempre aparece, mesmo que não passe no filtro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filtro impossível de herdar (Criada em antes de hoje): a tarefa fica à vista e a tela avisa qual filtro", async () => {
    // "Criada em" é a data do banco: ninguém a escolhe, então a tarefa nova NUNCA passa nele.
    await criarTarefaComFiltros([f("criada", "antes", "hoje"), f("titulo", "contem", "visivel")]);
    const tabela = await screen.findByRole("table", { name: "Tarefas" });
    await waitFor(() => expect(within(tabela).getByText("visivel")).toBeTruthy(), {
      timeout: 4000,
    });
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Criada em"));
  });

  it("quando a tarefa passa nos filtros, nenhum aviso aparece", async () => {
    await criarTarefaComFiltros([f("titulo", "contem", "normal")]);
    const tabela = await screen.findByRole("table", { name: "Tarefas" });
    await waitFor(() => expect(within(tabela).getByText("normal")).toBeTruthy(), { timeout: 4000 });
    expect(toast.info).not.toHaveBeenCalled();
  });
});
