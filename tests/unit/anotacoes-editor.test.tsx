// @vitest-environment jsdom
/**
 * O editor de Anotações é o motor de blocos da Estratégia: abre o conteúdo salvo (inclusive o do
 * editor anterior, convertido), grava blocos no formato de Marketing e, para quem só lê, mostra os
 * blocos prontos.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EditorDeNotas from "@/components/anotacoes/EditorDeNotas";
import type { Documento } from "@/lib/anotacoes/documento";

afterEach(cleanup);

const antigo = (): Documento => [
  {
    id: "b1",
    type: "paragraph",
    props: {},
    content: [{ type: "text", text: "Reunião de segunda", styles: {} }],
    children: [],
  },
  {
    id: "b2",
    type: "heading",
    props: { level: 2 },
    content: [{ type: "text", text: "Pauta", styles: {} }],
    children: [],
  },
  { id: "c1", type: "subpagina", props: { pageId: "filha1" }, children: [] },
];

describe("EditorDeNotas", () => {
  it("abre o texto salvo no formato antigo, já como blocos da Estratégia", async () => {
    render(<EditorDeNotas inicial={antigo()} editavel aoMudar={() => undefined} />);
    await waitFor(() => expect(screen.getByText("Reunião de segunda")).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Pauta" })).toBeTruthy();
  });

  it("escrever grava blocos no formato de Marketing (tipo), e Enter cria o próximo bloco", () => {
    const aoMudar = vi.fn();
    render(
      <EditorDeNotas
        inicial={[{ id: "a", tipo: "texto", texto: "Primeira" }]}
        editavel
        aoMudar={aoMudar}
      />,
    );
    fireEvent.doubleClick(screen.getByText("Primeira"));
    const campo = screen.getByDisplayValue("Primeira");
    fireEvent.keyDown(campo, { key: "Enter" });
    const ultimo = aoMudar.mock.calls.at(-1)![0] as Array<{ tipo: string }>;
    expect(ultimo.map((b) => b.tipo)).toEqual(["texto", "texto"]);
  });

  it("clicar na área vazia de uma página em branco cria o primeiro bloco de texto", () => {
    const aoMudar = vi.fn();
    render(<EditorDeNotas inicial={[]} editavel aoMudar={aoMudar} />);
    fireEvent.click(screen.getByRole("button", { name: "Escrever no fim da página" }));
    const ultimo = aoMudar.mock.calls.at(-1)![0] as Array<{ tipo: string; texto: string }>;
    expect(ultimo).toHaveLength(1);
    expect(ultimo[0]).toMatchObject({ tipo: "texto", texto: "" });
  });

  it("quem só lê vê os blocos prontos, sem campo de edição", () => {
    render(
      <EditorDeNotas
        inicial={[{ id: "a", tipo: "titulo", nivel: 1, texto: "Contrato" }]}
        editavel={false}
        aoMudar={() => undefined}
      />,
    );
    expect(screen.getByRole("heading", { name: "Contrato" })).toBeTruthy();
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
  });
});
