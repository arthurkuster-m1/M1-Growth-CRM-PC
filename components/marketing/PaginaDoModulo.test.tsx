/**
 * A PÁGINA DE UM MÓDULO, de ponta a ponta com a API simulada:
 *  - o CLIENTE só vê o publicado (nunca o rascunho, nunca os controles de edição);
 *  - a AGÊNCIA edita (o rascunho é salvo sozinho), publica e tira do ar.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Bloco } from "@/lib/marketing/blocos";
import type { PaginaDeMarketing } from "@/lib/marketing/paginas";

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import { PaginaDoModulo } from "./PaginaDoModulo";

const PUBLICADO: Bloco[] = [
  { id: "a", tipo: "titulo", nivel: 1, texto: "A persona" },
  { id: "b", tipo: "texto", texto: "Ana, 34 anos, dona de clínica." },
];
const RASCUNHO: Bloco[] = [
  ...PUBLICADO,
  { id: "c", tipo: "texto", texto: "RASCUNHO AINDA SECRETO" },
];

function pagina(sobre: Partial<PaginaDeMarketing>): PaginaDeMarketing {
  return {
    module_key: "estudo-de-persona",
    title: "",
    published_blocks: null,
    published_at: null,
    draft: null,
    pode_editar: false,
    ...sobre,
  };
}

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PaginaDoModulo
        chave="estudo-de-persona"
        titulo="Estudo de persona"
        descricao="Quem é o cliente ideal"
        superior="02 | Produto e Oferta"
        tom="purple"
        icone={<span />}
        rotulos={{ antes: "Antes", depois: "Depois", abrirLink: "Abrir link" }}
      />
    </QueryClientProvider>,
  );
}

function simular(p: PaginaDeMarketing) {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { page: p } });
  vi.mocked(apiClient.put).mockResolvedValue({ data: { updated_at: "2026-10-09T12:00:00Z" } });
  vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
}

describe("página do módulo — o cliente (só lê)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("vê o PUBLICADO, sem controles de edição", async () => {
    simular(pagina({ published_blocks: PUBLICADO, published_at: "2026-10-09T10:00:00Z" }));
    montar();
    expect(await screen.findByText("Ana, 34 anos, dona de clínica.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Adicionar bloco" })).toBeNull();
    expect(screen.queryByText("RASCUNHO AINDA SECRETO")).toBeNull();
    expect(screen.getByRole("button", { name: "Apresentar" })).toBeTruthy();
  });

  it("sem nada publicado: vê o aviso de que não foi publicada, e não pode editar", async () => {
    simular(pagina({}));
    montar();
    expect(await screen.findByText("Esta página ainda não foi publicada.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Apresentar" })).toBeNull();
  });
});

describe("página do módulo — a agência (edita)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("página publicada abre em Ver página; rascunho abre em Editar", async () => {
    simular(
      pagina({
        pode_editar: true,
        published_blocks: PUBLICADO,
        draft: { blocks: PUBLICADO, updated_at: "x" },
      }),
    );
    const { unmount } = montar();
    expect(await screen.findByRole("button", { name: "Editar", pressed: false })).toBeTruthy();
    unmount();
    simular(
      pagina({
        pode_editar: true,
        published_blocks: null,
        draft: { blocks: PUBLICADO, updated_at: "x" },
      }),
    );
    montar();
    expect(await screen.findByRole("button", { name: "Editar", pressed: true })).toBeTruthy();
  });

  it("edita o rascunho: o texto muda e é salvo SOZINHO depois de uma pausa", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    simular(
      pagina({
        pode_editar: true,
        published_blocks: PUBLICADO,
        draft: { blocks: PUBLICADO, updated_at: "x" },
      }),
    );
    montar();
    // Página publicada abre em "Ver página": a agência clica em Editar para mexer.
    await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
    const campo = await screen.findByDisplayValue("Ana, 34 anos, dona de clínica.");
    await userEvent.clear(campo);
    await userEvent.type(campo, "Nova ideia");
    expect(apiClient.put).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    const [url, corpo] = vi.mocked(apiClient.put).mock.calls[0]!;
    expect(url).toBe("/api/v1/marketing/pages/estudo-de-persona/draft");
    expect(JSON.stringify(corpo)).toContain("Nova ideia");
    vi.useRealTimers();
  });

  it("'Publicar' só habilita com alteração; ao publicar grava o rascunho e chama /publish", async () => {
    simular(
      pagina({
        pode_editar: true,
        published_blocks: PUBLICADO,
        draft: { blocks: RASCUNHO, updated_at: "x" },
      }),
    );
    montar();
    const publicar = await screen.findByRole("button", { name: "Publicar" });
    await waitFor(() => expect((publicar as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText("Há alterações não publicadas")).toBeTruthy();
    await userEvent.click(publicar);
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/marketing/pages/estudo-de-persona/publish",
        {},
      ),
    );
  });

  it("sem alteração em relação ao publicado: 'Publicar' fica desabilitado e aparece 'Publicada'", async () => {
    simular(
      pagina({
        pode_editar: true,
        published_blocks: PUBLICADO,
        draft: { blocks: PUBLICADO, updated_at: "x" },
      }),
    );
    montar();
    const publicar = (await screen.findByRole("button", { name: "Publicar" })) as HTMLButtonElement;
    expect(publicar.disabled).toBe(true);
    expect(screen.getByText("Publicada")).toBeTruthy();
  });

  it("'Tirar do ar' chama /unpublish", async () => {
    simular(
      pagina({
        pode_editar: true,
        published_blocks: PUBLICADO,
        draft: { blocks: PUBLICADO, updated_at: "x" },
      }),
    );
    montar();
    await userEvent.click(await screen.findByRole("button", { name: "Tirar do ar" }));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/marketing/pages/estudo-de-persona/unpublish",
        {},
      ),
    );
  });

  it("página em branco: oferece o modelo básico, que cria blocos editáveis", async () => {
    simular(pagina({ pode_editar: true }));
    montar();
    await userEvent.click(
      await screen.findByRole("button", { name: "Começar com um modelo básico" }),
    );
    expect(await screen.findAllByRole("region")).not.toHaveLength(0);
    expect(screen.getAllByText("Título").length).toBeGreaterThan(0);
  });

  it("'Apresentar' abre a tela cheia, a seta avança e Esc fecha", async () => {
    simular(
      pagina({
        pode_editar: true,
        published_blocks: PUBLICADO,
        draft: { blocks: PUBLICADO, updated_at: "x" },
      }),
    );
    montar();
    await userEvent.click(await screen.findByRole("button", { name: "Apresentar" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.textContent).toContain("1 / 2");
    await userEvent.keyboard("{ArrowRight}");
    expect(dialogo.textContent).toContain("2 / 2");
    expect(dialogo.textContent).toContain("A persona");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
