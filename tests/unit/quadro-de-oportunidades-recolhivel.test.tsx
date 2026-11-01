// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuadroDeOportunidades } from "@/components/clientes/QuadroDeOportunidades";

interface L {
  id: string;
  nome: string;
}

function montar(aoAbrir = vi.fn()) {
  render(
    <QuadroDeOportunidades<L>
      grupos={[
        {
          chave: "g",
          titulo: null,
          colunas: [{ chave: "c1", nome: "Novo lead", cor: "gray", porFunil: { f1: "e1" } }],
        },
      ]}
      linhas={[{ id: "1", nome: "Rodrigo Souza" }]}
      idDe={(l) => l.id}
      etapaDe={() => "e1"}
      funilDe={() => "f1"}
      tituloDe={(l) => l.nome}
      colunas={[
        {
          id: "campanha",
          titulo: "Campanha",
          icone: null,
          largura: 100,
          celula: () => <span>Implantes</span>,
        } as never,
      ]}
      podeEditar
      aoMover={vi.fn()}
      aoAbrir={aoAbrir}
    />,
  );
  return { aoAbrir };
}

describe("Quadro de oportunidades com cartões recolhíveis", () => {
  it("o cartão começa só com o nome; a seta mostra e esconde as propriedades", () => {
    montar();
    expect(screen.getByText("Rodrigo Souza")).toBeTruthy();
    expect(screen.queryByText("Implantes")).toBeNull();
    fireEvent.click(screen.getByLabelText("Mostrar as propriedades"));
    expect(screen.getByText("Implantes")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Esconder as propriedades"));
    expect(screen.queryByText("Implantes")).toBeNull();
  });
  it("clicar no nome abre o lead; clicar na seta não abre", () => {
    const { aoAbrir } = montar();
    fireEvent.click(screen.getByLabelText("Mostrar as propriedades"));
    expect(aoAbrir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Rodrigo Souza"));
    expect(aoAbrir).toHaveBeenCalledTimes(1);
  });
});
