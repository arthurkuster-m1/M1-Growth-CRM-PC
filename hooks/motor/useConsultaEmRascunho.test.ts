// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PreferenciasDaTabela } from "@/lib/motor/layout";

import { useConsultaEmRascunho } from "./useConsultaEmRascunho";

const salvas: PreferenciasDaTabela = {
  filtros: [{ campo: "prazo", operador: "ate", valor: "hoje" }],
};

function montar(opcoes: { podeSalvar?: boolean; ativaId?: string } = {}) {
  const atualizar = vi.fn();
  const hook = renderHook(
    ({ ativaId }) =>
      useConsultaEmRascunho({
        ativaId,
        salvas,
        atualizar,
        podeSalvar: opcoes.podeSalvar ?? true,
      }),
    { initialProps: { ativaId: opcoes.ativaId ?? "v1" } },
  );
  return { ...hook, atualizar };
}

describe("useConsultaEmRascunho", () => {
  it("sem mexer, vale o salvo e nada aparece para salvar", () => {
    const { result } = montar();
    expect(result.current.preferencias.filtros).toEqual(salvas.filtros);
    expect(result.current.salvamento.alterada).toBe(false);
  });

  it("mexer vira rascunho (não grava) e o Reset volta ao salvo", () => {
    const { result, atualizar } = montar();
    act(() => result.current.mudarConsulta({}));
    expect(result.current.preferencias.filtros).toBeUndefined();
    expect(result.current.salvamento.alterada).toBe(true);
    expect(atualizar).not.toHaveBeenCalled();
    act(() => result.current.salvamento.aoResetar());
    expect(result.current.preferencias.filtros).toEqual(salvas.filtros);
    expect(result.current.salvamento.alterada).toBe(false);
  });

  it("Salvar grava o rascunho como o novo padrão da aba", () => {
    const { result, atualizar } = montar();
    act(() => result.current.mudarConsulta({ ordenacao: [{ campo: "titulo", direcao: "asc" }] }));
    act(() => result.current.salvamento.aoSalvar!());
    expect(atualizar).toHaveBeenCalledTimes(1);
    const aplicar = atualizar.mock.calls[0]![0] as (
      p: PreferenciasDaTabela,
    ) => PreferenciasDaTabela;
    const gravado = aplicar({ larguras: { titulo: 300 }, filtros: salvas.filtros });
    expect(gravado).toMatchObject({
      larguras: { titulo: 300 },
      filtros: undefined,
      ordenacao: [{ campo: "titulo", direcao: "asc" }],
    });
  });

  it("cada aba tem o seu rascunho", () => {
    const { result, rerender } = montar();
    act(() => result.current.mudarConsulta({}));
    rerender({ ativaId: "v2" });
    expect(result.current.salvamento.alterada).toBe(false);
    rerender({ ativaId: "v1" });
    expect(result.current.salvamento.alterada).toBe(true);
  });

  it("quem não pode alterar a visualização não recebe o Salvar", () => {
    const { result } = montar({ podeSalvar: false });
    expect(result.current.salvamento.aoSalvar).toBeUndefined();
  });
});
