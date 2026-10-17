import { describe, expect, it } from "vitest";

import { atendentesDoTipoNaMatriz, type MatrizDeAtendentes } from "./equipe-hooks";

const base: MatrizDeAtendentes = {
  tabela_existe: true,
  tipos: [{ id: "t1", nome: "Reunião", responsavel_padrao: "dono" }],
  matriz: [],
  membros: [],
  com_google: [],
};

describe("atendentesDoTipoNaMatriz", () => {
  it("sem linhas para o tipo, vale o responsável padrão", () => {
    expect(atendentesDoTipoNaMatriz(base, "t1")).toEqual(["dono"]);
  });
  it("com linhas, valem só as ativas do tipo", () => {
    const m = {
      ...base,
      matriz: [
        { event_type_id: "t1", user_id: "ana", priority: 1, is_active: true },
        { event_type_id: "t1", user_id: "beto", priority: 2, is_active: false },
        { event_type_id: "t2", user_id: "cris", priority: 1, is_active: true },
      ],
    };
    expect(atendentesDoTipoNaMatriz(m, "t1")).toEqual(["ana"]);
  });
  it("sem dados, ninguém", () => {
    expect(atendentesDoTipoNaMatriz(undefined, "t1")).toEqual([]);
  });
});
