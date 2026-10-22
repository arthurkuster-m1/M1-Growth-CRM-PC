// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { Bloco } from "@/lib/marketing/blocos";

import { EditorVisualDeBlocos } from "./EditorVisualDeBlocos";

let ultimo: Bloco[] = [];
let n = 0;
const rotulos = { antes: "Antes", depois: "Depois", abrirLink: "Abrir" };

function Casca({ inicial }: { inicial: Bloco[] }) {
  const [blocos, setBlocos] = useState(inicial);
  return (
    <EditorVisualDeBlocos
      blocos={blocos}
      aoMudar={(b) => {
        ultimo = b;
        setBlocos(b);
      }}
      novoId={() => `novo${n++}`}
      rotulos={rotulos}
    />
  );
}

const iniciais = (): Bloco[] => [
  { id: "a", tipo: "titulo", nivel: 1, texto: "Primeiro" },
  { id: "b", tipo: "texto", texto: "Segundo" },
  { id: "c", tipo: "texto", texto: "Terceiro" },
];
const linha = (id: string) => document.querySelector<HTMLElement>(`[data-bloco-id="${id}"]`)!;
const alvo = (id: string) => within(linha(id)).getAllByRole("group")[0]!;
const raiz = () => screen.getByRole("group", { name: "Blocos da página" });

describe("EditorVisualDeBlocos", () => {
  it("mostra o bloco como o cliente vê e abre a caixa de edição com dois cliques", () => {
    render(<Casca inicial={iniciais()} />);
    expect(screen.getByRole("heading", { name: "Primeiro" })).toBeTruthy();
    fireEvent.doubleClick(alvo("b"));
    const campo = screen.getByDisplayValue("Segundo");
    fireEvent.change(campo, { target: { value: "Editado" } });
    // o resultado já aparece no bloco final, na mesma tela
    expect(screen.getAllByText("Editado").length).toBeGreaterThan(0);
    expect(ultimo[1]).toMatchObject({ texto: "Editado" });
  });

  it("seleção em massa: Shift+clique, Ctrl+Shift+5 troca o tipo e Ctrl+Z desfaz", () => {
    render(<Casca inicial={iniciais()} />);
    fireEvent.mouseDown(alvo("a"), { button: 0 });
    fireEvent.mouseDown(alvo("c"), { button: 0, shiftKey: true });
    expect(document.querySelectorAll('[aria-selected="true"]')).toHaveLength(3);
    fireEvent.keyDown(raiz(), { code: "Digit5", ctrlKey: true, shiftKey: true });
    expect(ultimo.map((b) => b.tipo)).toEqual(["lista", "lista", "lista"]);
    fireEvent.keyDown(raiz(), { key: "z", ctrlKey: true });
    expect(ultimo.map((b) => b.tipo)).toEqual(["titulo", "texto", "texto"]);
    fireEvent.keyDown(raiz(), { key: "z", ctrlKey: true, shiftKey: true });
    expect(ultimo.map((b) => b.tipo)).toEqual(["lista", "lista", "lista"]);
  });

  it("Delete apaga os selecionados e Ctrl+Z devolve", () => {
    render(<Casca inicial={iniciais()} />);
    fireEvent.mouseDown(alvo("b"), { button: 0 });
    fireEvent.mouseDown(alvo("c"), { button: 0, shiftKey: true });
    fireEvent.keyDown(raiz(), { key: "Delete" });
    expect(ultimo.map((b) => b.id)).toEqual(["a"]);
    fireEvent.keyDown(raiz(), { key: "z", ctrlKey: true });
    expect(ultimo.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("botão direito abre o menu com tamanho e alinhamento, e aplica", () => {
    render(<Casca inicial={iniciais()} />);
    fireEvent.contextMenu(alvo("a"));
    const menu = screen.getByRole("menu");
    fireEvent.click(within(menu).getByText("Título pequeno"));
    expect(ultimo[0]).toMatchObject({ tipo: "titulo", nivel: 3 });
    fireEvent.contextMenu(alvo("a"));
    fireEvent.click(within(screen.getByRole("menu")).getByText("Centro"));
    expect(ultimo[0]).toMatchObject({ alinhamento: "centro" });
  });

  it("o menu transforma em qualquer tipo, inclusive os visuais", () => {
    render(<Casca inicial={iniciais()} />);
    fireEvent.contextMenu(alvo("b"));
    fireEvent.click(within(screen.getByRole("menu")).getByText("Fluxo (passo a passo)"));
    expect(ultimo[1]).toMatchObject({ id: "b", tipo: "fluxo" });
  });

  it("Adicionar bloco insere e já abre a edição", () => {
    render(<Casca inicial={iniciais()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar bloco" }));
    fireEvent.click(within(screen.getByRole("menu")).getByText("Matriz 2x2 (SWOT)"));
    expect(ultimo.at(-1)).toMatchObject({ tipo: "matriz" });
    expect(screen.getByRole("button", { name: "Concluir" })).toBeTruthy();
  });
});
