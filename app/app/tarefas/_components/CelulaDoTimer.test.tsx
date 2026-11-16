// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CelulaDoTimer } from "./CelulaDoTimer";

const base = { status: "pending", tempo_gasto_seg: 125, cronometros: [] };

describe("CelulaDoTimer", () => {
  it("mostra o total e Iniciar; clicar inicia", async () => {
    const aoIniciar = vi.fn();
    render(
      <CelulaDoTimer
        tarefa={base}
        userId="u1"
        podeEditar
        aoIniciar={aoIniciar}
        aoParar={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tempo-da-tarefa").textContent).toBe("2:05");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar o cronômetro" }));
    expect(aoIniciar).toHaveBeenCalledTimes(1);
  });

  it("com o cronômetro da pessoa rodando mostra Parar; clicar para", async () => {
    const aoParar = vi.fn();
    const tarefa = {
      ...base,
      cronometros: [{ user_id: "u1", started_at: new Date(Date.now() - 10_000).toISOString() }],
    };
    render(
      <CelulaDoTimer
        tarefa={tarefa}
        userId="u1"
        podeEditar
        aoIniciar={vi.fn()}
        aoParar={aoParar}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Parar o cronômetro" }));
    expect(aoParar).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tempo-da-tarefa").textContent).toMatch(/^2:[1-2]\d$/);
  });

  it("outra pessoa cronometrando aparece como +1 e a tarefa concluída não inicia", () => {
    const tarefa = {
      status: "done",
      tempo_gasto_seg: 0,
      cronometros: [{ user_id: "outra", started_at: new Date().toISOString() }],
    };
    render(
      <CelulaDoTimer
        tarefa={tarefa}
        userId="u1"
        podeEditar
        aoIniciar={vi.fn()}
        aoParar={vi.fn()}
      />,
    );
    expect(screen.getByText("+1")).toBeTruthy();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem permissão de editar o botão fica desligado", () => {
    render(
      <CelulaDoTimer
        tarefa={base}
        userId="u1"
        podeEditar={false}
        aoIniciar={vi.fn()}
        aoParar={vi.fn()}
      />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
