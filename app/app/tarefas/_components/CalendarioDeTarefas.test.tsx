/**
 * O CALENDÁRIO: a tarefa pode mostrar propriedades dentro dela (o bloquinho editável) e as
 * tarefas sem prazo ficam numa faixa de onde se arrasta para um dia.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import type { Tarefa } from "@/lib/tarefas/tipos";

import { CalendarioDeTarefas } from "./CalendarioDeTarefas";

const base = {
  organization_id: "org",
  description: null,
  priority: "medium",
  status: "pending",
  lead_id: null,
  contact_id: null,
  assigned_to: null,
  created_by: null,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z",
} as const;

const comPrazo: Tarefa = {
  ...base,
  id: "a",
  title: "Enviar proposta",
  due_date: "2026-10-16T15:00:00.000Z",
};
const semPrazo: Tarefa = { ...base, id: "b", title: "Revisão semanal", due_date: null };

const status: ColunaDoMotor<Tarefa> = {
  id: "status",
  titulo: "Status",
  icone: null,
  largura: 100,
  celula: () => <span>Não iniciada</span>,
};

function montar(colunas: ColunaDoMotor<Tarefa>[]) {
  return render(
    <CalendarioDeTarefas
      tarefas={[comPrazo, semPrazo]}
      opcoes={[]}
      fuso="America/Sao_Paulo"
      tag="pt-BR"
      hoje="2026-10-16"
      podeEditar
      aoMudarPrazo={vi.fn()}
      aoAbrir={vi.fn()}
      colunas={colunas}
    />,
  );
}

describe("CalendarioDeTarefas", () => {
  // A tarefa do dia no computador é o bloquinho arrastável da grade (no celular a lista do dia repete o título).
  const bloquinho = (titulo: string) =>
    screen
      .getAllByText(titulo)
      .map((el) => el.closest<HTMLElement>('[aria-roledescription="draggable"]'))
      .find((el): el is HTMLElement => el !== null)!;

  it("sem propriedades escolhidas, a tarefa mostra só o título", () => {
    montar([]);
    expect(bloquinho("Enviar proposta")).toBeTruthy();
    expect(screen.queryByText("Não iniciada")).toBeNull();
  });

  it("com propriedades escolhidas, elas aparecem dentro da tarefa, abaixo do título", () => {
    montar([status]);
    expect(within(bloquinho("Enviar proposta")).getByText("Não iniciada")).toBeTruthy();
  });

  it("as tarefas sem prazo ficam na faixa de baixo, prontas para arrastar", () => {
    montar([]);
    expect(screen.getByText("Sem prazo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revisão semanal" })).toBeTruthy();
    expect(screen.getByText(/Arraste uma tarefa para um dia/)).toBeTruthy();
  });
});
