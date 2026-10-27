import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlanoDeTarefas } from "@/lib/tarefas/plano";

import { AplicarPlano } from "./AplicarPlano";

vi.mock("./CelulaDeCliente", () => ({
  CelulaDeCliente: ({
    aoEscolher,
  }: {
    aoEscolher: (c: { id: string | null; nome: string | null }) => void;
  }) => (
    <button type="button" onClick={() => aoEscolher({ id: "c1", nome: "Maria" })}>
      escolher cliente
    </button>
  ),
}));

afterEach(cleanup);

const PLANO: PlanoDeTarefas = {
  id: "p1",
  nome: "Boas-vindas",
  descricao: null,
  passos: [
    {
      ordem: 1,
      titulo: "Ligar",
      descricao: null,
      vence_em_dias: 1,
      prioridade: "high",
      atribuir_a: "dono_do_lead",
    },
    {
      ordem: 2,
      titulo: "Enviar caso",
      descricao: "Mande o caso de sucesso",
      vence_em_dias: 5,
      prioridade: "medium",
      atribuir_a: { usuario_id: "11111111-1111-4111-8111-111111111111" },
    },
  ],
};

describe("AplicarPlano", () => {
  it("cria todas as tarefas do plano, na ordem, para o cliente escolhido e com os prazos acertados", async () => {
    const aoCriar = vi.fn(async () => undefined);
    const aoFechar = vi.fn();
    render(
      <AplicarPlano
        plano={PLANO}
        fuso="America/Sao_Paulo"
        hoje="2026-10-26"
        organizacao="M1"
        aoFechar={aoFechar}
        aoCriar={aoCriar}
      />,
    );

    fireEvent.click(screen.getByText("escolher cliente"));
    // O prazo de cada tarefa nasce do início (hoje + dias do passo) e pode ser mudado à mão.
    // O seletor de data do app: o botão mostra o dia em dd/mm/aaaa; o calendário traz o campo de digitação.
    expect(screen.getByLabelText("Prazo: Ligar").textContent).toContain("27/10/2026");
    expect(screen.getByLabelText("Prazo: Enviar caso").textContent).toContain("31/10/2026");
    fireEvent.click(screen.getByLabelText("Prazo: Ligar"));
    fireEvent.change(screen.getAllByLabelText("Prazo: Ligar")[1]!, { target: { value: "03/11/2026" } });

    fireEvent.click(screen.getByRole("button", { name: "Criar 2 tarefas" }));
    await waitFor(() => expect(aoCriar).toHaveBeenCalledTimes(1));

    const tarefas = (aoCriar.mock.calls[0] as unknown as [Array<Record<string, unknown>>])[0];
    expect(tarefas.map((x) => x.title)).toEqual(["Ligar", "Enviar caso"]);
    expect(tarefas.every((x) => x.contact_id === "c1")).toBe(true);
    expect(tarefas[0]).toMatchObject({ priority: "high", due_date: "2026-11-03T03:00:00.000Z" });
    expect(tarefas[0]!.assigned_to).toBeUndefined();
    expect(tarefas[1]).toMatchObject({
      description: "Mande o caso de sucesso",
      assigned_to: "11111111-1111-4111-8111-111111111111",
      due_date: "2026-10-31T03:00:00.000Z",
    });
    await waitFor(() => expect(aoFechar).toHaveBeenCalled());
  });
});
