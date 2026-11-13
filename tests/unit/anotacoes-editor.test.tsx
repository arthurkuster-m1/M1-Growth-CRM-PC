/**
 * O editor de Anotações abre com o conteúdo salvo, mostra a subpágina como cartão (com o título
 * vivo da árvore) e acrescenta o cartão da filha que ainda não tinha.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import EditorDeNotas from "@/components/anotacoes/EditorDeNotas";
import type { ResumoDaNota } from "@/lib/anotacoes/paginas";

vi.mock("@/lib/theme", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));

function nota(id: string, parent: string | null, title: string, position = 1): ResumoDaNota {
  return {
    id,
    parent_id: parent,
    title,
    icon: null,
    position,
    visible_to_client: false,
    kind: null,
    deleted_at: null,
    updated_at: "2026-11-12T00:00:00Z",
  };
}

// O jsdom não tem o que o editor e a interface dele pedem do navegador: estas são as pontes mínimas.
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const vazio = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  Range.prototype.getBoundingClientRect ??= vazio as never;
  Range.prototype.getClientRects ??= (() => [] as unknown as DOMRectList) as never;
  document.elementFromPoint ??= () => null;
});

afterEach(cleanup);

describe("EditorDeNotas", () => {
  it("abre o texto salvo e os cartões das subpáginas, inclusive a que ainda não tinha cartão", async () => {
    render(
      <EditorDeNotas
        inicial={[
          {
            id: "b1",
            type: "paragraph",
            props: {},
            content: [{ type: "text", text: "Reunião de segunda", styles: {} }],
            children: [],
          },
          { id: "c1", type: "subpagina", props: { pageId: "filha1" }, children: [] },
        ]}
        editavel
        paginas={[
          nota("mae", null, "Mãe"),
          nota("filha1", "mae", "Contrato assinado", 1),
          nota("filha2", "mae", "Briefing", 2),
        ]}
        paginaId="mae"
        aoMudar={() => undefined}
        aoAbrir={() => undefined}
        aoCriarSubpagina={async () => null}
        aoRemoverSubpagina={() => undefined}
        aoReordenarSubpaginas={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByText("Reunião de segunda")).toBeTruthy());
    expect(screen.getByText("Contrato assinado")).toBeTruthy();
    expect(screen.getByText("Briefing")).toBeTruthy();
  });

  it("não mostra cartão de página que não é mais filha desta", async () => {
    render(
      <EditorDeNotas
        inicial={[{ id: "c1", type: "subpagina", props: { pageId: "outra" }, children: [] }]}
        editavel={false}
        paginas={[nota("mae", null, "Mãe"), nota("outra", null, "Solta")]}
        paginaId="mae"
        aoMudar={() => undefined}
        aoAbrir={() => undefined}
        aoCriarSubpagina={async () => null}
        aoRemoverSubpagina={() => undefined}
        aoReordenarSubpaginas={() => undefined}
      />,
    );
    await waitFor(() => expect(document.querySelector(".bn-editor")).toBeTruthy());
    expect(screen.queryByText("Solta")).toBeNull();
  });

  it("desenha os blocos visuais com os dados salvos, e dado ruim vira o padrão sem quebrar", async () => {
    const props = (dados: string, extra: Record<string, string> = {}) => ({ dados, ...extra });
    render(
      <EditorDeNotas
        inicial={[
          {
            id: "f",
            type: "fluxo",
            props: props(
              JSON.stringify([
                { titulo: "Captar", texto: "" },
                { titulo: "Fechar", texto: "" },
              ]),
            ),
            children: [],
          },
          {
            id: "m",
            type: "matriz",
            props: props(JSON.stringify([{ titulo: "Forças", texto: "Equipe" }]), {
              estilo: "swot",
            }),
            children: [],
          },
          {
            id: "c",
            type: "cartoes",
            props: props(JSON.stringify([{ titulo: "Plano A", texto: "" }])),
            children: [],
          },
          {
            id: "k",
            type: "metricas",
            props: props(JSON.stringify([{ titulo: "128", texto: "Leads" }])),
            children: [],
          },
          {
            id: "p",
            type: "piramide",
            props: props(JSON.stringify(["Topo", "Base"]), { forma: "funil" }),
            children: [],
          },
          { id: "r", type: "fluxo", props: props("{isso não é json"), children: [] },
          {
            id: "d",
            type: "destaque",
            props: { tom: "atencao" },
            content: [{ type: "text", text: "Cuidado com o prazo", styles: {} }],
            children: [],
          },
        ]}
        editavel
        paginas={[nota("mae", null, "Mãe")]}
        paginaId="mae"
        aoMudar={() => undefined}
        aoAbrir={() => undefined}
        aoCriarSubpagina={async () => null}
        aoRemoverSubpagina={() => undefined}
        aoReordenarSubpaginas={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByText("Cuidado com o prazo")).toBeTruthy());
    expect(screen.getByDisplayValue("Captar")).toBeTruthy();
    expect(screen.getByDisplayValue("Fechar")).toBeTruthy();
    expect(screen.getByDisplayValue("Equipe")).toBeTruthy();
    expect(screen.getByDisplayValue("Plano A")).toBeTruthy();
    expect(screen.getByDisplayValue("128")).toBeTruthy();
    expect(screen.getByDisplayValue("Leads")).toBeTruthy();
    expect(screen.getByDisplayValue("Topo")).toBeTruthy();
    // O fluxo com JSON quebrado caiu no padrão (três etapas), e o editor segue de pé.
    expect(screen.getAllByDisplayValue("Etapa 1").length).toBe(1);
  });

  it("clicar no meio de uma linha, fora do texto, já coloca o cursor nela (sem precisar clicar de novo)", async () => {
    const { container } = render(
      <EditorDeNotas
        inicial={[
          {
            id: "l1",
            type: "paragraph",
            props: {},
            content: [{ type: "text", text: "Primeira linha", styles: {} }],
            children: [],
          },
          {
            id: "l2",
            type: "paragraph",
            props: {},
            content: [{ type: "text", text: "Segunda linha", styles: {} }],
            children: [],
          },
        ]}
        editavel
        paginas={[nota("mae", null, "Mãe")]}
        paginaId="mae"
        aoMudar={() => undefined}
        aoAbrir={() => undefined}
        aoCriarSubpagina={async () => null}
        aoRemoverSubpagina={() => undefined}
        aoReordenarSubpaginas={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByText("Segunda linha")).toBeTruthy());
    // No jsdom nada tem tamanho: dou a cada linha a sua faixa de altura.
    const faixas: Record<string, [number, number]> = { l1: [0, 30], l2: [30, 60] };
    for (const el of container.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")) {
      const [topo, base] = faixas[el.dataset.id!] ?? [0, 0];
      el.getBoundingClientRect = () =>
        ({
          top: topo,
          bottom: base,
          left: 0,
          right: 500,
          width: 500,
          height: base - topo,
          x: 0,
          y: topo,
        }) as DOMRect;
    }
    // O alvo é a "caixa" da linha, não o texto: é onde o clique caía no meio/ao lado da frase.
    const caixaDaLinha = container.querySelector<HTMLElement>('[data-id="l2"] .bn-block-content')!;
    fireEvent.mouseDown(caixaDaLinha, { button: 0, clientX: 400, clientY: 45 });
    fireEvent.mouseUp(window, { clientX: 400, clientY: 45 });
    await waitFor(() => {
      const no = window.getSelection()?.anchorNode ?? null;
      expect(no && container.querySelector('[data-id="l2"]')?.contains(no)).toBeTruthy();
    });
  });

  it("Delete apaga todos os blocos escolhidos com o retângulo, inclusive os especiais", async () => {
    const mudou = vi.fn();
    const { container } = render(
      <EditorDeNotas
        inicial={[
          {
            id: "l1",
            type: "paragraph",
            props: {},
            content: [{ type: "text", text: "Primeira", styles: {} }],
            children: [],
          },
          {
            id: "fx",
            type: "fluxo",
            props: { dados: JSON.stringify([{ titulo: "Captar", texto: "" }]) },
            children: [],
          },
          { id: "mt", type: "matriz", props: {}, children: [] },
          {
            id: "l4",
            type: "paragraph",
            props: {},
            content: [{ type: "text", text: "Quarta", styles: {} }],
            children: [],
          },
        ]}
        editavel
        paginas={[nota("mae", null, "Mãe")]}
        paginaId="mae"
        aoMudar={mudou}
        aoAbrir={() => undefined}
        aoCriarSubpagina={async () => null}
        aoRemoverSubpagina={() => undefined}
        aoReordenarSubpaginas={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByText("Quarta")).toBeTruthy());
    const faixas: Record<string, [number, number]> = {
      l1: [0, 30],
      fx: [30, 90],
      mt: [90, 150],
      l4: [150, 180],
    };
    for (const el of container.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")) {
      const [topo, base] = faixas[el.dataset.id!] ?? [0, 0];
      el.getBoundingClientRect = () =>
        ({
          top: topo,
          bottom: base,
          left: 0,
          right: 500,
          width: 500,
          height: base - topo,
          x: 0,
          y: topo,
        }) as DOMRect;
    }
    // Arrasta no espaço em branco, do alto da primeira linha até o meio do último bloco especial.
    const papel = container.firstElementChild as HTMLElement;
    fireEvent.mouseDown(papel, { button: 0, clientX: 520, clientY: 5 });
    fireEvent.mouseMove(window, { clientX: 300, clientY: 120 });
    fireEvent.mouseUp(window, { clientX: 300, clientY: 120 });
    fireEvent.keyDown(document.body, { key: "Delete" });

    await waitFor(() => {
      const ultimo = mudou.mock.calls.at(-1)?.[0] as Array<{ id: string }> | undefined;
      expect(ultimo).toBeTruthy();
      const ids = ultimo!.map((b) => b.id);
      expect(ids).not.toContain("l1");
      expect(ids).not.toContain("fx");
      expect(ids).not.toContain("mt");
      expect(ids).toContain("l4");
    });
  });
});
