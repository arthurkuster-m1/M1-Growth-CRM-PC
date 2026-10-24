import { describe, expect, it } from "vitest";

import {
  agregarProspeccao,
  agruparExtracoes,
  classificarResultado,
  derivarProspeccao,
  recorteAnterior,
  type BaseDaProspeccao,
  type ExtracaoDoPainel,
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
  custos: [{ dia: "2026-10-01", fonte: "extração", valor: 40 }],
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
      investimento: 140,
    });
    const d = derivarProspeccao(t);
    expect(d.custoPorAbordagem).toBeCloseTo(46.67, 1);
    expect(d.taxaDeResposta).toBe(50);
  });
  it("recorta por tipo sem inventar custo", () => {
    const t = agregarProspeccao(base, recorte, { tipo: "ligacao" });
    expect(t).toMatchObject({ abordagens: 2, leadsAbordados: 1, investimento: 0, leads: 0 });
  });
  it("a fonte só leva o custo lançado para ela, não o orçamento da campanha", () => {
    const f = agregarProspeccao(base, recorte, { fonte: "Extração" });
    expect(f).toMatchObject({ leads: 1, investimento: 40 });
    expect(derivarProspeccao(f).cpl).toBe(40);
  });
  it("recorta por dia", () => {
    expect(agregarProspeccao(base, recorte, { dia: "2026-10-03" }).abordagens).toBe(2);
  });
  it("o período anterior tem o mesmo tamanho", () => {
    expect(recorteAnterior(recorte)).toEqual({ de: "2026-09-26", ate: "2026-09-30" });
  });
});

describe("por extração, termo e cidade", () => {
  const extracoes: ExtracaoDoPainel[] = [
    {
      id: "e1",
      nome: "clínicas · Batel",
      tipo: "extracao",
      termo: "Clínicas",
      cidade: "Batel",
      modo: "completo",
    },
    {
      id: "e2",
      nome: "clínicas · Centro",
      tipo: "extracao",
      termo: "clínicas",
      cidade: "Centro",
      modo: "volume",
    },
    {
      id: "e3",
      nome: "dentistas · Batel",
      tipo: "extracao",
      termo: "dentistas",
      cidade: "Batel",
      modo: "completo",
    },
    { id: "i1", nome: "base.csv", tipo: "importacao", termo: null, cidade: null, modo: null },
  ];
  const baseDeExtracoes: BaseDaProspeccao = {
    leads: [
      { id: "l1", dia: "2026-10-01", fonte: "Extração de leads", extracao: "e1" },
      { id: "l2", dia: "2026-10-01", fonte: "Extração de leads", extracao: "e1" },
      { id: "l3", dia: "2026-10-02", fonte: "Extração de leads", extracao: "e2" },
      { id: "l4", dia: "2026-10-02", fonte: "Extração de leads", extracao: "e3" },
      { id: "l5", dia: "2026-10-03", fonte: "Importação de planilha", extracao: "i1" },
    ],
    interacoes: [],
    reunioes: [],
    vendas: [{ leadId: "l1", dia: "2026-10-05" }],
    pagamentos: [{ leadId: "l1", dia: "2026-10-05", valor: 1000 }],
    investimentoPorDia: { "2026-10-01": 500 },
    custos: [
      { dia: "2026-10-01", fonte: "Extração de leads", valor: 20, extracao: "e1" },
      { dia: "2026-10-02", fonte: "Extração de leads", valor: 10, extracao: "e2" },
      { dia: "2026-10-02", fonte: "Extração de leads", valor: 30, extracao: "e3" },
    ],
  };
  const recorte = { de: "2026-10-01", ate: "2026-10-31" };

  it("agrupa cada extração sozinha, por termo (sem diferenciar caixa) e por cidade", () => {
    expect(agruparExtracoes(extracoes, "extracao").map((g) => g.nome)).toEqual([
      "base.csv",
      "clínicas · Batel",
      "clínicas · Centro",
      "dentistas · Batel",
    ]);
    const termos = agruparExtracoes(extracoes, "termo");
    expect(termos.map((g) => g.nome)).toEqual(["Clínicas", "dentistas"]);
    expect([...termos[0]!.ids].sort()).toEqual(["e1", "e2"]);
    const cidades = agruparExtracoes(extracoes, "cidade");
    expect(cidades.map((g) => g.nome)).toEqual(["Batel", "Centro"]);
    // Importação não tem termo nem cidade: só aparece no agrupamento por extração.
    expect(cidades.flatMap((g) => [...g.ids])).not.toContain("i1");
  });

  it("mede cada grupo só com os leads e os custos dele — e o CPL sai por termo", () => {
    const clinicas = agruparExtracoes(extracoes, "termo").find((g) => g.chave === "clínicas")!;
    const b = agregarProspeccao(baseDeExtracoes, recorte, { extracoes: clinicas.ids });
    // e1 (2 leads, R$ 20) + e2 (1 lead, R$ 10): o orçamento da campanha (R$ 500) não entra.
    expect(b).toMatchObject({ leads: 3, investimento: 30, vendas: 1, recebido: 1000 });
    expect(derivarProspeccao(b).cpl).toBe(10);
    const dentistas = agregarProspeccao(baseDeExtracoes, recorte, { extracoes: new Set(["e3"]) });
    expect(derivarProspeccao(dentistas).cpl).toBe(30);
  });

  it("importação não tem custo próprio: CPL em branco, mas conta os leads", () => {
    const b = agregarProspeccao(baseDeExtracoes, recorte, { extracoes: new Set(["i1"]) });
    expect(b).toMatchObject({ leads: 1, investimento: 0 });
  });
});
