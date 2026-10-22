// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ConsultaDaTabela } from "@/lib/motor/consulta";

import { BarraDeConsulta, type CampoDaBarra } from "./BarraDeConsulta";

const campos: CampoDaBarra[] = [
  { id: "titulo", titulo: "Título", tipo: "texto" },
  { id: "prazo", titulo: "Prazo", tipo: "data" },
];

describe("BarraDeConsulta — filtro salvo vira o padrão da visualização", () => {
  const consulta: ConsultaDaTabela = {
    filtros: [{ campo: "prazo", operador: "ate", valor: "hoje" }],
  };

  it("sem rascunho não há Limpar tudo, nem Reset, nem Salvar", () => {
    render(
      <BarraDeConsulta
        campos={campos}
        consulta={consulta}
        aoMudar={() => undefined}
        salvamento={{ alterada: false, aoResetar: () => undefined, aoSalvar: () => undefined }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Limpar tudo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("com rascunho aparecem Reset e Salvar, e cada um chama o seu", () => {
    const aoResetar = vi.fn();
    const aoSalvar = vi.fn();
    render(
      <BarraDeConsulta
        campos={campos}
        consulta={consulta}
        aoMudar={() => undefined}
        salvamento={{ alterada: true, aoResetar, aoSalvar }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(aoResetar).toHaveBeenCalledTimes(1);
    expect(aoSalvar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Limpar tudo" })).toBeNull();
  });

  it("quem não pode salvar a visualização só tem o Reset", () => {
    render(
      <BarraDeConsulta
        campos={campos}
        consulta={consulta}
        aoMudar={() => undefined}
        salvamento={{ alterada: true, aoResetar: () => undefined }}
      />,
    );
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("telas sem o salvamento seguem com o Limpar tudo de sempre", () => {
    const aoMudar = vi.fn();
    render(<BarraDeConsulta campos={campos} consulta={consulta} aoMudar={aoMudar} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar tudo" }));
    expect(aoMudar).toHaveBeenCalledWith({});
  });

  it('monta "Prazo está em Esta semana" pelo painel de filtros', async () => {
    const aoMudar = vi.fn();
    render(
      <BarraDeConsulta
        campos={campos}
        consulta={{ filtros: [{ campo: "prazo", operador: "periodo" }] }}
        aoMudar={aoMudar}
        salvamento={{ alterada: false, aoResetar: () => undefined }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Filtrar/ }));
    // o valor do filtro de período oferece os períodos, sem "Data exata…"
    await userEvent.click(screen.getByRole("button", { name: /Valor do filtro/ }));
    const dialogos = await screen.findAllByRole("dialog");
    const lista = dialogos[dialogos.length - 1]!;
    expect(within(lista).getByText("Esta semana")).toBeTruthy();
    expect(within(lista).queryByText("Data exata…")).toBeNull();
    await userEvent.click(within(lista).getByText("Esta semana"));
    expect(aoMudar).toHaveBeenCalledWith({
      filtros: [{ campo: "prazo", operador: "periodo", valor: "esta_semana" }],
    });
  });
});
