import { describe, expect, it } from "vitest";

import {
  agregarProspeccao,
  classificarResultado,
  derivarProspeccao,
  recorteAnterior,
  type BaseDaProspeccao,
} from "./prospeccao";

describe("classificarResultado", () => {
  it("separa contato, decisor e o que não é nenhum", () => {
    expect(classificarResultado("Atendeu — falou com o decisor")).toEqual({
      contato: true,
      decisor: true,
    });
    expect(classificarResultado("Atendeu — não é o decisor")).toEqual({
      contato: true,
      decisor: false,
    });
    expect(classificarResultado("Respondeu — sem interesse")).toEqual({
      contato: true,
      decisor: false,
    });
    expect(classificarResultado("Não atendeu")).toEqual({ contato: false, decisor: false });
    expect(classificarResultado("Caixa postal")).toEqual({ contato: false, decisor: false });
    expect(classificarResultado(null)).toEqual({ contato: false, decisor: false });
  });
});

const base: BaseDaProspeccao = {
  leads: [
    { id: "a", dia: "2026-10-01", fonte: "Extração" },
    { id: "b", dia: "2026-10-02", fonte: "Indicação" },
  ],
  interacoes: [
    {
      dia: "2026-10-02",
      leadId: "a",
      tipo: "ligacao",
      abordagemId: "x",
      contato: false,
      decisor: false,
    },
    {
      dia: "2026-10-03",
      leadId: "a",
      tipo: "ligacao",
      abordagemId: "x",
      contato: true,
      decisor: true,
    },
    {
      dia: "2026-10-03",
      leadId: "b",
      tipo: "email",
      abordagemId: null,
      contato: false,
      decisor: false,
    },
  ],
  reunioes: [{ dia: "2026-10-04", leadId: "a", tipo: "agendada" }],
  vendas: [],
  pagamentos: [],
  investimentoPorDia: { "2026-10-01": 50, "2026-10-02": 50 },
};
const recorte = { de: "2026-10-01", ate: "2026-10-05" };

describe("agregarProspeccao", () => {
  it("conta pessoa uma vez e abordagem a cada tentativa", () => {
    const t = agregarProspeccao(base, recorte);
    expect(t).toMatchObject({
      leads: 2,
      abordagens: 3,
      leadsAbordados: 2,
      contatos: 1,
      decisores: 1,
      reunioesAgendadas: 1,
      investimento: 100,
    });
    const d = derivarProspeccao(t);
    expect(d.custoPorAbordagem).toBeCloseTo(33.33, 1);
    expect(d.taxaDeResposta).toBe(50);
  });
  it("recorta por tipo sem inventar custo", () => {
    const t = agregarProspeccao(base, recorte, { tipo: "ligacao" });
    expect(t).toMatchObject({ abordagens: 2, leadsAbordados: 1, investimento: 0, leads: 0 });
  });
  it("recorta por dia", () => {
    expect(agregarProspeccao(base, recorte, { dia: "2026-10-03" }).abordagens).toBe(2);
  });
  it("o período anterior tem o mesmo tamanho", () => {
    expect(recorteAnterior(recorte)).toEqual({ de: "2026-09-26", ate: "2026-09-30" });
  });
});
