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
  it("mostra o bloco como o cliente vê e permite digitar direto nele com dois cliques", () => {
    render(<Casca inicial={iniciais()} />);
    expect(screen.getByRole("heading", { name: "Primeiro" })).toBeTruthy();
    // sem edição, o texto é só texto (nenhum campo)
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    fireEvent.doubleClick(alvo("b"));
    const campo = screen.getByDisplayValue("Segundo");
    expect(campo.tagName).toBe("TEXTAREA");
    fireEvent.change(campo, { target: { value: "Editado" } });
    expect(ultimo[1]).toMatchObject({ texto: "Editado" });
    expect(screen.getByDisplayValue("Editado")).toBeTruthy();
    // Esc encerra a digitação e o bloco volta a ser só texto
    fireEvent.keyDown(campo, { key: "Escape" });
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(screen.getByText("Editado")).toBeTruthy();
  });

  it("lista: Enter cria o próximo item e Backspace no vazio o remove", () => {
    render(<Casca inicial={[{ id: "l", tipo: "lista", estilo: "marcadores", itens: ["um"] }]} />);
    fireEvent.doubleClick(alvo("l"));
    fireEvent.keyDown(screen.getByDisplayValue("um"), { key: "Enter" });
    expect((ultimo[0] as { itens: string[] }).itens).toEqual(["um", ""]);
    const campos = document.querySelectorAll("textarea");
    fireEvent.keyDown(campos[1]!, { key: "Backspace" });
    expect((ultimo[0] as { itens: string[] }).itens).toEqual(["um"]);
  });

  it("blocos visuais também se digitam no lugar (cartões, tabela, matriz)", () => {
    render(
      <Casca
        inicial={[
          { id: "t", tipo: "tabela", colunas: ["A", "B"], linhas: [["1"]] },
          { id: "m", tipo: "matriz", estilo: "swot", celulas: [{ titulo: "Forças", texto: "" }] },
        ]}
      />,
    );
    fireEvent.doubleClick(alvo("t"));
    fireEvent.change(screen.getByDisplayValue("1"), { target: { value: "novo" } });
    expect(ultimo[0]).toMatchObject({ linhas: [["novo", ""]] });
    fireEvent.doubleClick(alvo("m"));
    fireEvent.change(screen.getByDisplayValue("Forças"), { target: { value: "Pontos fortes" } });
    expect((ultimo[1] as { celulas: { titulo: string }[] }).celulas[0]!.titulo).toBe(
      "Pontos fortes",
    );
  });

  it("o lápis abre a caixa com todos os campos", () => {
    render(<Casca inicial={iniciais()} />);
    fireEvent.mouseDown(alvo("b"), { button: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Editar todos os campos do bloco" }));
    expect(screen.getByRole("button", { name: "Concluir" })).toBeTruthy();
  });

  it("Modelos: adiciona ao final ou substitui a página (pede confirmação)", () => {
    render(<Casca inicial={iniciais()} />);
    fireEvent.click(screen.getByRole("button", { name: "Modelos" }));
    // o primeiro modelo da lista é o básico: título, texto, título e lista
    fireEvent.click(
      within(screen.getByRole("menu")).getAllByRole("button", { name: "Adicionar ao final" })[0]!,
    );
    expect(ultimo).toHaveLength(7);

    fireEvent.click(screen.getByRole("button", { name: "Modelos" }));
    // "Página em branco" é a primeira linha: o 1º clique só pede confirmação…
    fireEvent.click(
      within(screen.getByRole("menu")).getAllByRole("button", { name: "Substituir a página" })[0]!,
    );
    expect(ultimo).toHaveLength(7);
    // …o 2º apaga tudo, e Ctrl+Z devolve
    fireEvent.click(
      within(screen.getByRole("menu")).getByRole("button", {
        name: "Confirmar: apagar tudo e usar",
      }),
    );
    expect(ultimo).toHaveLength(0);
    fireEvent.keyDown(raiz(), { key: "z", ctrlKey: true });
    expect(ultimo).toHaveLength(7);
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

  it("Adicionar bloco insere e já põe para digitar; blocos sem texto abrem a caixa", () => {
    render(<Casca inicial={iniciais()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar bloco" }));
    fireEvent.click(within(screen.getByRole("menu")).getByText("Matriz 2x2 (SWOT)"));
    expect(ultimo.at(-1)).toMatchObject({ tipo: "matriz" });
    expect(document.querySelectorAll("textarea").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar bloco" }));
    fireEvent.click(within(screen.getByRole("menu")).getByText("Oferta"));
    expect(screen.getByRole("button", { name: "Concluir" })).toBeTruthy();
  });
});
