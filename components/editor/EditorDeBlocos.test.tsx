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

  it("Tab e Shift+Tab valem para a seleção", () => {
    render(<Casca inicial={"a\nb\nc"} />);
    const raiz = screen.getByRole("group", { name: "Descrição" });
    fireEvent.keyDown(campos()[1]!, { key: "Escape" });
    fireEvent.keyDown(raiz, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(raiz, { key: "Tab" });
    expect(ultimo).toHaveLength(1);
    expect(ultimo[0]?.filhos?.map((b) => b.texto)).toEqual(["b", "c"]);
    fireEvent.keyDown(raiz, { key: "Tab", shiftKey: true });
    expect(ultimo.map((b) => b.texto)).toEqual(["a", "b", "c"]);
  });

  it("arrastar o mouse de um bloco a outro seleciona os blocos no caminho", () => {
    render(<Casca inicial={"a\nb\nc"} />);
    const linhas = Array.from(document.querySelectorAll<HTMLElement>("[data-linha]"));
    document.elementFromPoint = () => campos()[2]!;
    fireEvent.mouseDown(campos()[0]!, { button: 0 });
    fireEvent.mouseMove(document, { clientX: 5, clientY: 90 });
    fireEvent.mouseUp(document);
    expect(linhas.filter((l) => l.className.includes("ring-1"))).toHaveLength(3);
  });

  it("Ctrl+Z desfaz a digitação em sequência de uma vez e Ctrl+Shift+Z refaz", () => {
    render(<Casca inicial="a" />);
    const c = () => campos()[0]!;
    fireEvent.change(c(), { target: { value: "ab" } });
    fireEvent.change(c(), { target: { value: "abc" } });
    expect(ultimo[0]?.texto).toBe("abc");
    fireEvent.keyDown(c(), { key: "z", ctrlKey: true });
    expect(ultimo[0]?.texto).toBe("a");
    fireEvent.keyDown(c(), { key: "z", ctrlKey: true, shiftKey: true });
    expect(ultimo[0]?.texto).toBe("abc");
  });

  it("Ctrl+Z desfaz a exclusão de blocos selecionados e a troca de tipo", () => {
    render(<Casca inicial={"a\nb\nc"} />);
    const raiz = screen.getByRole("group", { name: "Descrição" });
    fireEvent.keyDown(campos()[0]!, { code: "Digit5", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(campos()[1]!, { key: "Escape" });
    fireEvent.keyDown(raiz, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(raiz, { key: "Delete" });
    expect(ultimo.map((b) => b.texto)).toEqual(["a"]);
    fireEvent.keyDown(campos()[0]!, { key: "z", ctrlKey: true });
    expect(ultimo.map((b) => b.texto)).toEqual(["a", "b", "c"]);
    fireEvent.keyDown(campos()[0]!, { key: "z", ctrlKey: true });
    expect(ultimo[0]?.tipo).toBe("texto");
  });

  it("'/' abre o menu de tipos e 'toggle' vira uma lista recolhível aberta", () => {
    render(<Casca inicial="" />);
    fireEvent.change(campos()[0]!, { target: { value: "/tog" } });
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(campos()[0]!, { key: "Enter" });
    expect(ultimo[0]).toMatchObject({ tipo: "toggle", texto: "", aberto: true });
  });

  it("Esc fecha o menu '/' e o texto fica", () => {
    render(<Casca inicial="" />);
    fireEvent.change(campos()[0]!, { target: { value: "/pro" } });
    fireEvent.keyDown(campos()[0]!, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(ultimo[0]?.texto).toBe("/pro");
  });

  it("'```' no começo vira bloco de prompt; Enter dentro dele quebra linha (não cria bloco)", () => {
    render(<Casca inicial="" />);
    fireEvent.change(campos()[0]!, { target: { value: "```" } });
    expect(ultimo[0]?.tipo).toBe("prompt");
    const antes = ultimo.length;
    fireEvent.keyDown(campos()[0]!, { key: "Enter" });
    expect(ultimo).toHaveLength(antes);
    fireEvent.keyDown(campos()[0]!, { key: "Enter", ctrlKey: true });
    expect(ultimo.map((b) => b.tipo)).toEqual(["prompt", "texto"]);
  });

  it("o botão Copiar do bloco de prompt copia o texto todo", async () => {
    const escreveu: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (t: string) => void escreveu.push(t) },
    });
    const longo = "# linha 1\n\nlinha 3 ".repeat(200);
    render(
      <Casca inicial={JSON.stringify({ v: 1, b: [{ id: "p", tipo: "prompt", texto: longo }] })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copiar prompt" }));
    await screen.findByText("Copiado!");
    expect(escreveu).toEqual([longo]);
  });

  it("colar texto grande no bloco de prompt não o quebra em vários blocos", () => {
    render(
      <Casca inicial={JSON.stringify({ v: 1, b: [{ id: "p", tipo: "prompt", texto: "" }] })} />,
    );
    ultimo = [];
    const naoCancelado = fireEvent.paste(campos()[0]!, {
      clipboardData: { getData: () => "## a\n- b\nc" },
    });
    // O editor não tomou a colagem para si: o navegador cola o texto inteiro dentro do campo.
    expect(naoCancelado).toBe(true);
    expect(ultimo).toHaveLength(0);
  });

  it("colar markdown num bloco de texto vira títulos e listas", () => {
    render(<Casca inicial="" />);
    fireEvent.paste(campos()[0]!, { clipboardData: { getData: () => "## Título\n- item" } });
    expect(ultimo.map((b) => b.tipo)).toEqual(["h2", "bullet"]);
  });

  it("links viram chips clicáveis fora da edição e voltam a texto ao focar", () => {
    render(<Casca inicial="veja https://www.instagram.com/p/AbC123/ já" />);
    const chip = screen.getByRole("link");
    expect(chip.getAttribute("href")).toBe("https://www.instagram.com/p/AbC123/");
    expect(chip.textContent).toContain("Instagram");
    fireEvent.focus(campos()[0]!);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.blur(campos()[0]!);
    expect(screen.getByRole("link")).toBeTruthy();
  });
});
