import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Bloco } from "@/lib/marketing/blocos";
import type { VersaoDaPagina } from "@/lib/marketing/historico";

import { HistoricoDaPagina } from "./HistoricoDaPagina";

const rotulos = { antes: "Antes", depois: "Depois", abrirLink: "Abrir" };
const bloco = (texto: string): Bloco => ({ id: texto, tipo: "texto", texto });
const versoes: VersaoDaPagina[] = [
  {
    id: "v2",
    taken_at: "2026-11-01T12:00:00Z",
    note: "Novo site",
    blocos: [bloco("Versão de novembro")],
  },
  { id: "v1", taken_at: "2026-10-01T12:00:00Z", note: "", blocos: [bloco("Versão de outubro")] },
];

function montar(agencia = false) {
  const aoSalvar = vi.fn().mockResolvedValue(true);
  const aoApagar = vi.fn().mockResolvedValue(true);
  render(
    <HistoricoDaPagina
      aberto
      aoFechar={() => {}}
      versoes={versoes}
      atual={[bloco("Versão de hoje")]}
      rotulos={rotulos}
      agencia={agencia ? { aoSalvar, aoApagar, podeSalvar: true } : undefined}
    />,
  );
  return { aoSalvar, aoApagar };
}

describe("HistoricoDaPagina", () => {
  it("mostra a versão mais recente e troca ao escolher outra data", async () => {
    montar();
    expect(screen.getByText("Versão de novembro")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /01\/10\/2026|10\/01\/2026/ }));
    expect(screen.getByText("Versão de outubro")).toBeTruthy();
  });

  it("compara com a versão de hoje", async () => {
    montar();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Versão de hoje")).toBeTruthy();
    expect(screen.getByText("Versão de novembro")).toBeTruthy();
  });

  it("o cliente não vê salvar nem apagar; a agência vê e salva com observação", async () => {
    montar();
    expect(screen.queryByText("Salvar retrato de hoje")).toBeNull();
    expect(screen.queryByLabelText("Apagar retrato")).toBeNull();
  });

  it("a agência salva o retrato com a observação digitada", async () => {
    const { aoSalvar } = montar(true);
    await userEvent.type(screen.getByLabelText("Observação do retrato"), "Mudou o site");
    await userEvent.click(screen.getByText("Salvar retrato de hoje"));
    expect(aoSalvar).toHaveBeenCalledWith("Mudou o site");
    expect(screen.getAllByLabelText("Apagar retrato")).toHaveLength(2);
  });
});
