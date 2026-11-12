/**
 * O editor de Anotações abre com o conteúdo salvo, mostra a subpágina como cartão (com o título
 * vivo da árvore) e acrescenta o cartão da filha que ainda não tinha.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
});
