/**
 * No CELULAR, a largura que a pessoa escolhe arrastando a alça vale em TODA coluna — o título
 * inclusive (antes ele voltava para a largura padrão ao soltar) — e fica até a gravação chegar.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/motor/useCelular", () => ({ useCelular: () => true }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));

import { TabelaDoMotor, type ColunaDoMotor } from "./TabelaDoMotor";

type Linha = { id: string; titulo: string };
const linhas: Linha[] = [{ id: "1", titulo: "Revisão Semanal" }];

function colunas(over: Partial<Record<string, unknown>> = {}): ColunaDoMotor<Linha>[] {
  return [
    {
      id: "titulo",
      titulo: "Título",
      largura: 400,
      semOcultar: true,
      larguraPersonalizada: true,
      celula: (l: Linha) => l.titulo,
      ...over,
    } as ColunaDoMotor<Linha>,
    { id: "status", titulo: "Status", largura: 300, celula: () => "Não iniciada" },
  ];
}

function gradeDoCabecalho() {
  return (screen.getAllByRole("row")[0] as HTMLElement).style.gridTemplateColumns;
}

function montar(cols: ColunaDoMotor<Linha>[], extra = {}) {
  return render(
    <TabelaDoMotor<Linha>
      linhas={linhas}
      idDe={(l) => l.id}
      colunas={cols}
      aoReordenar={() => undefined}
      podeReordenar={false}
      rotuloDaTabela="Tarefas"
      {...extra}
    />,
  );
}

describe("largura das colunas no celular", () => {
  it("o título com largura escolhida mantém a escolha (não volta para 184px)", () => {
    montar(colunas());
    expect(gradeDoCabecalho()).toContain("minmax(400px");
    expect(gradeDoCabecalho()).not.toContain("minmax(184px");
  });

  it("sem escolha, o celular usa o padrão estreito (título 184px, demais no teto de 176px)", () => {
    montar(colunas({ larguraPersonalizada: false }));
    expect(gradeDoCabecalho()).toContain("minmax(184px");
    expect(gradeDoCabecalho()).toContain("minmax(176px");
  });

  it("ao soltar a alça a coluna fica na largura escolhida até a tela devolver a preferência", () => {
    const aoRedimensionar = vi.fn();
    montar(colunas({ larguraPersonalizada: false }), { aoRedimensionarColuna: aoRedimensionar });
    const alca = screen.getAllByRole("separator")[0] as HTMLElement;
    act(() => {
      fireEvent.pointerDown(alca, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(alca, { clientX: 220, pointerId: 1 });
      fireEvent.pointerUp(alca, { clientX: 220, pointerId: 1 });
    });
    expect(aoRedimensionar).toHaveBeenCalledWith("titulo", 184 + 120);
    // A gravação ainda não voltou (a prop não mudou): a coluna NÃO pula de volta.
    expect(gradeDoCabecalho()).toContain("minmax(304px");
  });
});
