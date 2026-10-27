import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FiltroDaAgenda, aplicaFiltroDaAgenda } from "./FiltroDaAgenda";
import type { Pessoa } from "./tipos";

const pessoas: Pessoa[] = [
  { id: "u1", nome: "Arthur", trilha: 1 },
  { id: "u2", nome: "Bia", trilha: 2 },
];

const lista = [
  { id: "a", responsavelId: "u1", tipo: "Reunião", origem: "ui" },
  { id: "b", responsavelId: "u2", tipo: "Reunião", origem: "ui" },
  { id: "c", responsavelId: "u2", tipo: "Retorno", origem: "ui" },
  { id: "g", responsavelId: "u2", origem: "google_sync" },
];
const ids = (l: typeof lista) => l.map((x) => x.id);

afterEach(cleanup);

describe("regra do filtro da agenda", () => {
  it("sem escolha, mostra tudo", () => {
    expect(ids(aplicaFiltroDaAgenda(lista, [], []))).toEqual(["a", "b", "c", "g"]);
  });
  it("um atendente, vários atendentes", () => {
    expect(ids(aplicaFiltroDaAgenda(lista, ["u1"], []))).toEqual(["a"]);
    expect(ids(aplicaFiltroDaAgenda(lista, ["u1", "u2"], []))).toEqual(["a", "b", "c", "g"]);
  });
  it("por tipo: o bloco do Google segue só a pessoa", () => {
    expect(ids(aplicaFiltroDaAgenda(lista, [], ["Retorno"]))).toEqual(["c", "g"]);
  });
  it("pessoa e tipo juntos", () => {
    expect(ids(aplicaFiltroDaAgenda(lista, ["u2"], ["Reunião"]))).toEqual(["b", "g"]);
  });
});

describe("<FiltroDaAgenda>", () => {
  it("escolher atendentes e tipos chama os dois avisos, e o botão resume", () => {
    const aoMudarPessoas = vi.fn();
    const aoMudarTipos = vi.fn();
    render(
      <FiltroDaAgenda
        pessoas={pessoas}
        tipos={["Reunião", "Retorno"]}
        pessoasEscolhidas={["u1"]}
        tiposEscolhidos={[]}
        aoMudarPessoas={aoMudarPessoas}
        aoMudarTipos={aoMudarTipos}
      />,
    );
    expect(screen.getByTestId("filtro-da-agenda-botao").textContent).toContain("Arthur");
    fireEvent.click(screen.getByTestId("filtro-da-agenda-botao"));
    fireEvent.click(screen.getByTestId("filtro-pessoa-u2"));
    expect(aoMudarPessoas).toHaveBeenCalledWith(["u1", "u2"]);
    fireEvent.click(screen.getByTestId("filtro-tipo-Retorno"));
    expect(aoMudarTipos).toHaveBeenCalledWith(["Retorno"]);
    fireEvent.click(screen.getByTestId("filtro-todas-as-pessoas"));
    expect(aoMudarPessoas).toHaveBeenLastCalledWith([]);
  });
});
