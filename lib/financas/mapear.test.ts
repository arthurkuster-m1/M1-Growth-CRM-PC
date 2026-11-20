import { describe, expect, it } from "vitest";

import { mapearCategorias, mapearContas } from "./mapear";

describe("mapearCategorias", () => {
  const grupos = [
    { id: "g1", nome: "Receitas", ordem: 10, sistema: false },
    { id: "g2", nome: "Sistema", ordem: 1000, sistema: true },
  ];
  const base = {
    cor: null,
    tipo: "entrada" as const,
    orcamento_mensal_cents: 0,
    ativa: true,
    ordem: 1,
  };

  it("traz o nome do grupo (o cálculo exclui 'Sistema' pelo nome) e zera o orçamento anual", () => {
    const r = mapearCategorias(
      [
        { id: "a", nome: "Vendas", group_id: "g1", ...base },
        { id: "b", nome: "Rendimentos", group_id: "g2", ...base },
        { id: "c", nome: "Solta", group_id: null, ...base },
      ],
      grupos,
    );
    expect(r.map((c) => c.grupo)).toEqual(["Receitas", "Sistema", null]);
    expect(r.every((c) => c.orcamento_anual_cents === 0)).toBe(true);
  });

  it("grupo que não existe mais vira sem grupo", () => {
    expect(
      mapearCategorias([{ id: "a", nome: "X", group_id: "sumiu", ...base }], grupos)[0]!.grupo,
    ).toBeNull();
  });
});

describe("mapearContas", () => {
  it("converte o rendimento que vem como texto", () => {
    const r = mapearContas([
      {
        id: "1",
        nome: "Banco",
        tipo: "investida",
        ativa: true,
        ordem: 1,
        rendimento_pct: "120.0000",
        rendimento_base: "cdi",
        dia_fechamento: null,
        dia_vencimento: null,
        conta_pagamento_id: null,
      },
      {
        id: "2",
        nome: "Caixa",
        tipo: "corrente",
        ativa: true,
        ordem: 2,
        rendimento_pct: null,
        rendimento_base: null,
        dia_fechamento: null,
        dia_vencimento: null,
        conta_pagamento_id: null,
      },
    ]);
    expect(r[0]!.rendimento_pct).toBe(120);
    expect(r[1]!.rendimento_pct).toBeNull();
  });
});
