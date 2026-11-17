/**
 * O MODO PLANILHA da tabela: selecionar células, copiar, colar, apagar e andar pelas setas, como
 * no Excel. Só as colunas com `colar` aceitam o que se cola.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/motor/useCelular", () => ({ useCelular: () => false }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import { TabelaDoMotor, type ColunaDoMotor } from "./TabelaDoMotor";

type Linha = { id: string; nome: string; fone: string };
const linhas: Linha[] = [
  { id: "1", nome: "Ana", fone: "111" },
  { id: "2", nome: "Beto", fone: "222" },
  { id: "3", nome: "Caio", fone: "333" },
];

function montar(colar = vi.fn()) {
  const colunas: ColunaDoMotor<Linha>[] = [
    {
      id: "nome",
      titulo: "Nome",
      largura: 200,
      semOcultar: true,
      celula: (l) => l.nome,
      colar: (l, v) => colar(l.id, "nome", v),
    },
    {
      id: "fone",
      titulo: "Telefone",
      largura: 200,
      celula: (l) => l.fone,
      colar: (l, v) => colar(l.id, "fone", v),
    },
    { id: "fixo", titulo: "Fixo", largura: 200, celula: () => "só leitura" },
  ];
  render(
    <TabelaDoMotor<Linha>
      planilha
      linhas={linhas}
      idDe={(l) => l.id}
      colunas={colunas}
      aoReordenar={() => undefined}
      podeReordenar={false}
      rotuloDaTabela="Leads"
    />,
  );
  return colar;
}

const celula = (l: number, c: number) =>
  document.querySelector<HTMLElement>(`[data-pl="${l}"][data-pc="${c}"]`)!;
const tabela = () => screen.getByRole("table").parentElement as HTMLElement;

afterEach(cleanup);

describe("TabelaDoMotor — modo planilha", () => {
  it("clicar seleciona a célula e as setas andam; Shift estende a faixa", () => {
    montar();
    fireEvent.mouseDown(celula(0, 0), { button: 0 });
    expect(celula(0, 0).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabela(), { key: "ArrowDown" });
    expect(celula(1, 0).getAttribute("aria-selected")).toBe("true");
    expect(celula(0, 0).getAttribute("aria-selected")).toBe("false");
    fireEvent.keyDown(tabela(), { key: "ArrowRight", shiftKey: true });
    expect(celula(1, 0).getAttribute("aria-selected")).toBe("true");
    expect(celula(1, 1).getAttribute("aria-selected")).toBe("true");
  });

  it("arrastar sobre outras células seleciona a faixa", () => {
    montar();
    fireEvent.mouseDown(celula(0, 0), { button: 0 });
    fireEvent.mouseEnter(celula(2, 1));
    fireEvent.mouseUp(document);
    for (const [l, c] of [
      [0, 0],
      [1, 1],
      [2, 1],
      [2, 0],
    ] as const) {
      expect(celula(l, c).getAttribute("aria-selected")).toBe("true");
    }
  });

  it("Ctrl+C copia a faixa como TSV", () => {
    montar();
    fireEvent.mouseDown(celula(0, 0), { button: 0 });
    fireEvent.mouseDown(celula(1, 1), { button: 0, shiftKey: true });
    const setData = vi.fn();
    fireEvent.copy(tabela(), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "Ana\t111\nBeto\t222");
  });

  it("Ctrl+V cola a grade a partir da célula e ignora coluna sem edição", async () => {
    const colar = montar();
    fireEvent.mouseDown(celula(1, 1), { button: 0 });
    fireEvent.paste(tabela(), { clipboardData: { getData: () => "999\tx\nabc\ty" } });
    // "x" e "y" caem na coluna "Fixo" (sem `colar`) e são ignorados; sobram só os dois do telefone.
    await waitFor(() => expect(colar).toHaveBeenCalledTimes(2));
    expect(colar).toHaveBeenCalledWith("2", "fone", "999");
    expect(colar).toHaveBeenCalledWith("3", "fone", "abc");
  });

  it("um valor sobre uma faixa preenche a faixa toda", async () => {
    const colar = montar();
    fireEvent.mouseDown(celula(0, 0), { button: 0 });
    fireEvent.mouseDown(celula(2, 0), { button: 0, shiftKey: true });
    fireEvent.paste(tabela(), { clipboardData: { getData: () => "Igual" } });
    await waitFor(() => expect(colar).toHaveBeenCalledTimes(3));
    expect(colar.mock.calls.map((c) => c[0])).toEqual(["1", "2", "3"]);
  });

  it("Delete apaga as células da seleção (texto vazio)", async () => {
    const colar = montar();
    fireEvent.mouseDown(celula(0, 1), { button: 0 });
    fireEvent.keyDown(tabela(), { key: "Delete" });
    await waitFor(() => expect(colar).toHaveBeenCalledWith("1", "fone", ""));
  });

  it("dentro de um campo de texto, as teclas são de quem digita", () => {
    const colar = montar();
    fireEvent.mouseDown(celula(0, 0), { button: 0 });
    const campo = document.createElement("input");
    celula(0, 0).appendChild(campo);
    fireEvent.keyDown(campo, { key: "Delete" });
    expect(colar).not.toHaveBeenCalled();
  });
});
