/**
 * LINHA DO TEMPO: a coluna do nome da tarefa (fixa à esquerda) pode ser alargada, e a escolha fica
 * no aparelho — para ler o nome inteiro sem perder a coluna fixa enquanto as datas rolam.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tarefa } from "@/lib/tarefas/tipos";

import { LinhaDoTempo } from "./LinhaDoTempo";

const tarefa: Tarefa = {
  organization_id: "org",
  id: "t1",
  title: "Revisão Semanal da operação inteira",
  description: null,
  priority: "medium",
  status: "pending",
  lead_id: null,
  contact_id: null,
  assigned_to: null,
  created_by: null,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z",
  start_date: "2026-10-20T12:00:00.000Z",
  due_date: "2026-10-22T12:00:00.000Z",
} as Tarefa;

function montar() {
  return render(
    <LinhaDoTempo
      tarefas={[tarefa]}
      opcoes={[]}
      fuso="America/Sao_Paulo"
      tag="pt-BR"
      hoje="2026-10-21"
      podeEditar
      aoMudarDatas={vi.fn()}
      aoAbrir={vi.fn()}
    />,
  );
}

// O nome aparece na coluna fixa (botão com `title`) e dentro da barra; a coluna é a que importa.
const botaoDoNome = () =>
  screen
    .getAllByRole("button", { name: /Revisão Semanal/ })
    .find((b) => b.getAttribute("title") !== null)!;

describe("largura da coluna do nome na linha do tempo", () => {
  beforeEach(() => window.localStorage.clear());

  it("sem escolha, vale a largura padrão (classes), sem largura em linha", () => {
    montar();
    expect(botaoDoNome().style.width).toBe("");
  });

  it("arrastar a alça muda a largura do nome e guarda a escolha", () => {
    montar();
    const alca = screen.getByRole("separator");
    act(() => {
      fireEvent.pointerDown(alca, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(alca, { clientX: 260, pointerId: 1 });
      fireEvent.pointerUp(alca, { clientX: 260, pointerId: 1 });
    });
    // jsdom não mede (largura 0 no cabeçalho → parte de 112): 112 + 160.
    expect(botaoDoNome().style.width).toBe("272px");
    expect(window.localStorage.getItem("tarefas:linha-do-tempo:largura-do-nome")).toBe("272");
  });

  it("pelo teclado, as setas mudam de 16 em 16 px", () => {
    montar();
    const alca = screen.getByRole("separator");
    fireEvent.keyDown(alca, { key: "ArrowRight" });
    expect(botaoDoNome().style.width).toBe("128px");
  });

  it("a largura guardada volta ao reabrir a tela", () => {
    window.localStorage.setItem("tarefas:linha-do-tempo:largura-do-nome", "300");
    montar();
    expect(botaoDoNome().style.width).toBe("300px");
  });

  it("a largura respeita os limites (88 a 520)", () => {
    montar();
    const alca = screen.getByRole("separator");
    act(() => {
      fireEvent.pointerDown(alca, { clientX: 100, pointerId: 1 });
      fireEvent.pointerUp(alca, { clientX: 5000, pointerId: 1 });
    });
    expect(botaoDoNome().style.width).toBe("520px");
  });
});
