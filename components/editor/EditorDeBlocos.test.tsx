// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { lerBlocos, type Bloco } from "@/lib/tarefas/blocos";

import { EditorDeBlocos } from "./EditorDeBlocos";

let ultimo: Bloco[] = [];
function Casca({ inicial }: { inicial: string }) {
  const [blocos, setBlocos] = useState(() => lerBlocos(inicial));
  return (
    <EditorDeBlocos
      blocos={blocos}
      aoMudar={(b) => {
        ultimo = b;
        setBlocos(b);
      }}
      podeEditar
    />
  );
}

const campos = () =>
  Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea[data-bloco]"));

describe("EditorDeBlocos", () => {
  it("Ctrl+Shift+4 vira lista de tarefas e Ctrl+Shift+1 vira título", () => {
    render(<Casca inicial="oi" />);
    fireEvent.keyDown(campos()[0]!, { code: "Digit4", ctrlKey: true, shiftKey: true });
    expect(ultimo[0]?.tipo).toBe("todo");
    fireEvent.keyDown(campos()[0]!, { code: "Digit1", ctrlKey: true, shiftKey: true });
    expect(ultimo[0]?.tipo).toBe("h1");
  });

  it("markdown no começo da linha vira o tipo", () => {
    render(<Casca inicial="" />);
    fireEvent.change(campos()[0]!, { target: { value: "- " } });
    expect(ultimo[0]?.tipo).toBe("bullet");
  });

  it("Enter divide o bloco e a lista continua; Enter no item vazio sai da lista", () => {
    render(<Casca inicial="a" />);
    fireEvent.keyDown(campos()[0]!, { code: "Digit5", ctrlKey: true, shiftKey: true });
    const c = campos()[0]!;
    c.setSelectionRange(1, 1);
    fireEvent.keyDown(c, { key: "Enter" });
    expect(ultimo.map((b) => b.tipo)).toEqual(["bullet", "bullet"]);
    fireEvent.keyDown(campos()[1]!, { key: "Enter" });
    expect(ultimo.map((b) => b.tipo)).toEqual(["bullet", "texto"]);
  });

  it("Backspace no começo de um bloco de texto junta com o anterior", () => {
    render(<Casca inicial={"ab\ncd"} />);
    const c = campos()[1]!;
    c.setSelectionRange(0, 0);
    fireEvent.keyDown(c, { key: "Backspace" });
    expect(ultimo).toHaveLength(1);
    expect(ultimo[0]?.texto).toBe("abcd");
  });

  it("o menu da alça troca o tipo", () => {
    render(<Casca inicial="x" />);
    fireEvent.contextMenu(screen.getByLabelText("Arrastar ou abrir o menu do bloco"));
    fireEvent.click(screen.getByText("Citação"));
    expect(ultimo[0]?.tipo).toBe("quote");
  });

  it("Tab afilha o bloco ao de cima e Shift+Tab devolve", () => {
    render(<Casca inicial={"Item 1\nItem a"} />);
    fireEvent.keyDown(campos()[1]!, { key: "Tab" });
    expect(ultimo).toHaveLength(1);
    expect(ultimo[0]?.filhos?.[0]?.texto).toBe("Item a");
    fireEvent.keyDown(campos()[1]!, { key: "Tab", shiftKey: true });
    expect(ultimo.map((b) => b.texto)).toEqual(["Item 1", "Item a"]);
    expect(ultimo[0]?.filhos).toBeUndefined();
  });

  it("afilhados em dois níveis e o primeiro filho não se afilha", () => {
    render(<Casca inicial={"1\na\ni"} />);
    fireEvent.keyDown(campos()[1]!, { key: "Tab" });
    fireEvent.keyDown(campos()[2]!, { key: "Tab" }); // "i" vira irmão de "a"…
    fireEvent.keyDown(campos()[2]!, { key: "Tab" }); // …e depois filho dele
    expect(ultimo).toHaveLength(1);
    expect(ultimo[0]?.filhos?.[0]?.filhos?.[0]?.texto).toBe("i");
    fireEvent.keyDown(campos()[1]!, { key: "Tab" }); // "a" é o 1º filho: não tem irmão acima
    expect(ultimo[0]?.filhos?.[0]?.texto).toBe("a");
  });

  it("Esc seleciona o bloco, Shift+↓ estende e Delete apaga os selecionados", () => {
    render(<Casca inicial={"a\nb\nc\nd"} />);
    const raiz = screen.getByRole("group", { name: "Descrição" });
    fireEvent.keyDown(campos()[1]!, { key: "Escape" });
    fireEvent.keyDown(raiz, { key: "ArrowDown", shiftKey: true });
    expect(document.querySelectorAll("[data-linha].ring-1")).toHaveLength(2);
    fireEvent.keyDown(raiz, { key: "Delete" });
    expect(ultimo.map((b) => b.texto)).toEqual(["a", "d"]);
  });

  it("Shift+↑ no começo do texto começa a selecionar; Ctrl+Shift+5 troca todos", () => {
    render(<Casca inicial={"a\nb\nc"} />);
    const raiz = screen.getByRole("group", { name: "Descrição" });
    const c = campos()[1]!;
    c.setSelectionRange(0, 0);
    fireEvent.keyDown(c, { key: "ArrowUp", shiftKey: true });
    fireEvent.keyDown(raiz, { code: "Digit5", ctrlKey: true, shiftKey: true });
    expect(ultimo.map((b) => b.tipo)).toEqual(["bullet", "bullet", "texto"]);
  });

  it("copiar e colar blocos selecionados duplica o conteúdo", () => {
    render(<Casca inicial={"a\nb"} />);
    const raiz = screen.getByRole("group", { name: "Descrição" });
    fireEvent.keyDown(campos()[0]!, { key: "Escape" });
    fireEvent.keyDown(raiz, { key: "ArrowDown", shiftKey: true });
    let guardado = "";
    fireEvent.copy(raiz, { clipboardData: { setData: (_t: string, v: string) => (guardado = v) } });
    expect(guardado).toBe("a\nb");
    fireEvent.paste(raiz, { clipboardData: { getData: () => guardado } });
    expect(ultimo.map((b) => b.texto)).toEqual(["a", "b", "a", "b"]);
  });
});
