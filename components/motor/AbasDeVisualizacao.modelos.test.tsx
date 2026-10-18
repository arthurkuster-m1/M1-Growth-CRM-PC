import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AbasDeVisualizacao } from "./AbasDeVisualizacao";

describe("AbasDeVisualizacao — abas prontas", () => {
  it("o + oferece o modelo e criá-lo é um clique", async () => {
    const aoCriarModelo = vi.fn();
    render(
      <AbasDeVisualizacao
        abas={[{ id: "padrao", nome: "Tabela", tipo: "tabela" }]}
        ativaId="padrao"
        podeEditar
        aoEscolher={vi.fn()}
        aoCriar={vi.fn()}
        aoConfigurar={vi.fn()}
        modelos={[{ id: "radar", nome: "Radar", descricao: "O que esfriou e pede ação." }]}
        aoCriarModelo={aoCriarModelo}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Nova visualização" }));
    await userEvent.click(screen.getByRole("button", { name: /Radar/ }));
    expect(aoCriarModelo).toHaveBeenCalledWith("radar");
  });

  it("sem modelos, o + continua só com a criação em branco", async () => {
    render(
      <AbasDeVisualizacao
        abas={[{ id: "padrao", nome: "Tabela", tipo: "tabela" }]}
        ativaId="padrao"
        podeEditar
        aoEscolher={vi.fn()}
        aoCriar={vi.fn()}
        aoConfigurar={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Nova visualização" }));
    expect(screen.queryByText("Prontas")).toBeNull();
  });
});
