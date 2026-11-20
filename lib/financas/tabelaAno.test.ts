import { describe, expect, it } from "vitest";
import type { DetalheCategoria, GrupoDetalhe } from "./anual";
import {
  achatar,
  chaveCat,
  diferenca,
  filtrarGrupos,
  ordenar,
  porMesDoGrupo,
  serie,
  seriesPorChave,
} from "./tabelaAno";

const mes = (v: number[]) => Array.from({ length: 12 }, (_, i) => v[i] ?? 0);
const cat = (id: string, nome: string, v: number[]): DetalheCategoria => {
  const porMes = mes(v);
  const total = porMes.reduce((a, x) => a + x, 0);
  return {
    id,
    nome,
    cor: null,
    grupoId: "g",
    tipo: "saida",
    ativa: true,
    total,
    pago: total,
    previsto: 0,
    media: Math.round(total / 12),
    porMes,
    maiorMes: null,
    orcamentoAno: 0,
    usado: null,
  };
};
const grupo = (id: string, nome: string, cs: DetalheCategoria[]): GrupoDetalhe => ({
  grupoId: id,
  nome,
  categorias: cs,
  total: cs.reduce((a, c) => a + c.total, 0),
  previsto: cs.reduce((a, c) => a + c.previsto, 0),
  media: 0,
  orcamentoAno: 0,
  usado: null,
});
const G = [
  grupo("g1", "Casa", [cat("a", "Mercado", [100, 200]), cat("b", "Luz", [50])]),
  grupo("g2", "Saúde", [cat("c", "Plano de saúde", [400])]),
];

describe("tabelaAno", () => {
  it("soma o grupo mês a mês", () =>
    expect(porMesDoGrupo(G[0]!).slice(0, 3)).toEqual([150, 200, 0]));
  it("ordena por total decrescente e por nome", () => {
    expect(ordenar(G, "total", "desc").map((g) => g.nome)).toEqual(["Saúde", "Casa"]);
    expect(ordenar(G[0]!.categorias, "nome", "asc").map((c) => c.nome)).toEqual(["Luz", "Mercado"]);
  });
  it("filtra ignorando acento; grupo que casa traz tudo", () => {
    expect(filtrarGrupos(G, "SAUDE").map((g) => g.nome)).toEqual(["Saúde"]);
    const r = filtrarGrupos(G, "merc");
    expect(r).toHaveLength(1);
    expect(r[0]!.categorias.map((c) => c.nome)).toEqual(["Mercado"]);
    expect(filtrarGrupos(G, "casa")[0]!.categorias).toHaveLength(2);
    expect(filtrarGrupos(G, "")).toBe(G);
  });
  it("achata com o nome do grupo", () =>
    expect(achatar(G).map((c) => `${c.grupoNome}/${c.nome}`)).toEqual([
      "Casa/Mercado",
      "Casa/Luz",
      "Saúde/Plano de saúde",
    ]));
  it("séries por chave e diferença", () => {
    const m = seriesPorChave(G);
    const a = serie("x", "Mercado", m.get(chaveCat("a"))!),
      b = serie("y", "Luz", m.get(chaveCat("b"))!);
    expect(diferenca(a, b)).toMatchObject({ total: -250, pct: expect.closeTo(-83.33, 1) });
    expect(diferenca(serie("z", "z", mes([])), b).pct).toBeNull();
  });
  it("ordena pelo % do orçamento consumido; sem orçamento vai sempre para o fim", () => {
    const l = [
      { nome: "A", total: 1, media: 0, orcamentoAno: 100, usado: 0.5 },
      { nome: "B", total: 1, media: 0, orcamentoAno: 10, usado: 1.4 },
      { nome: "C", total: 9, media: 0, orcamentoAno: 0, usado: null },
      { nome: "D", total: 1, media: 0, orcamentoAno: 1000, usado: 0.98 },
    ];
    expect(ordenar(l, "uso", "desc").map((x) => x.nome)).toEqual(["B", "D", "A", "C"]);
    expect(ordenar(l, "uso", "asc").map((x) => x.nome)).toEqual(["A", "D", "B", "C"]);
    expect(ordenar(l, "orcamento", "desc").map((x) => x.nome)).toEqual(["D", "A", "B", "C"]); // pelo valor do orçamento continua igual
  });
});
