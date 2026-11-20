import { describe, expect, it } from "vitest";
import type { Categoria } from "./tipos";
import {
  agruparDetalhes,
  detalharCategorias,
  empilharPorMes,
  mesesComInformacao,
  patrimonioPrevisto,
} from "./anual";
import type { ItemHistorico } from "./historico";

const cat = (
  id: string,
  tipo: "entrada" | "saida",
  group_id: string | null = null,
  mensal = 0,
  anual = 0,
  grupo: string | null = null,
): Categoria => ({
  id,
  nome: id,
  group_id,
  grupo,
  cor: null,
  tipo,
  orcamento_mensal_cents: mensal,
  orcamento_anual_cents: anual,
  ativa: true,
  ordem: 0,
});
let n = 0;
const it_ = (
  mes: string,
  tipo: "entrada" | "saida",
  valor: number,
  categoriaId: string | null,
  previsto = false,
): ItemHistorico => ({ id: `i${++n}`, mes, tipo, valor, previsto, categoriaId });

describe("Visão do ano — cálculos", () => {
  it("meses que entram na média: de janeiro até o último mês COM lançamento (pago ou previsto)", () => {
    const l = (mes: string, e: number, sa: number) => ({
      mes,
      entradas: { total: e },
      saidas: { total: sa },
    });
    const ano = Array.from({ length: 12 }, (_, i) =>
      l(`2026-${String(i + 1).padStart(2, "0")}`, 0, 0),
    );
    expect(mesesComInformacao(ano)).toBe(0);
    ano[8] = l("2026-09", 100, 0); // só até setembro → 9
    expect(mesesComInformacao(ano)).toBe(9);
    ano[2] = l("2026-03", 0, 0); // mês vazio no meio continua contando
    expect(mesesComInformacao(ano)).toBe(9);
    ano[10] = l("2026-11", 0, 50);
    expect(mesesComInformacao(ano)).toBe(11);
    expect(mesesComInformacao(ano, "entradas")).toBe(9);
    expect(mesesComInformacao(ano, "saidas")).toBe(11);
  });
  const cats = [
    cat("Mercado", "saida", "g1", 0, 1200_00),
    cat("Casa", "saida", "g1", 100_00),
    cat("Salário", "entrada", "g2", 5000_00),
    cat("Ajuste", "saida", null, 0, 0, "Sistema"),
  ];
  const itens = [
    it_("2026-01", "saida", 300_00, "Mercado"),
    it_("2026-03", "saida", 600_00, "Mercado"),
    it_("2026-03", "saida", 50_00, "Casa"),
    it_("2026-04", "saida", 100_00, "Mercado", true),
    it_("2026-01", "entrada", 5000_00, "Salário"),
    it_("2026-02", "entrada", 5000_00, "Salário"),
    it_("2026-02", "saida", 20_00, null),
  ];
  it("detalha total, média, maior mês e uso do orçamento por categoria (Sistema fora)", () => {
    const d = detalharCategorias(itens, cats, 4);
    const m = d.find((x) => x.id === "Mercado")!;
    expect(m).toMatchObject({
      total: 1000_00,
      pago: 900_00,
      previsto: 100_00,
      media: 250_00,
      maiorMes: { mes: 3, valor: 600_00 },
      orcamentoAno: 1200_00,
    });
    expect(m.usado).toBeCloseTo(1000 / 1200);
    expect(d.find((x) => x.id === "Casa")).toMatchObject({ orcamentoAno: 1200_00, total: 50_00 }); // só mensal 100 → teto do ano = ×12
    expect(d.some((x) => x.id === "Ajuste")).toBe(false);
    expect(d.find((x) => x.id === null)).toMatchObject({ nome: "Sem categoria", total: 20_00 });
  });
  it("agrupa por grupo cadastrado, com média/total/uso do grupo e 'Sem grupo' no fim", () => {
    const d = detalharCategorias(itens, cats, 4);
    const g = agruparDetalhes(
      d.filter((x) => x.tipo === "saida"),
      [
        { id: "g1", nome: "Home" },
        { id: "g2", nome: "Renda" },
      ],
      4,
    );
    expect(g.map((x) => x.nome)).toEqual(["Home", "Sem grupo"]);
    expect(g[0]).toMatchObject({
      total: 1050_00,
      media: Math.round(1050_00 / 4),
      orcamentoAno: 2400_00,
    });
    expect(g[0]!.usado).toBeCloseTo(1050 / 2400);
  });
  it("barras empilhadas por categoria, com lucro; filtro mostra só a categoria", () => {
    const m = empilharPorMes(itens, cats, ["2026-01", "2026-02", "2026-03"], null);
    expect(m[0]).toMatchObject({ totalEntradas: 5000_00, totalSaidas: 300_00, lucro: 4700_00 });
    expect(m[1]!.saidas.map((s) => s.nome)).toEqual(["Sem categoria"]);
    expect(m[2]!.saidas.map((s) => [s.nome, s.pago])).toEqual([
      ["Mercado", 600_00],
      ["Casa", 50_00],
    ]);
    const f = empilharPorMes(itens, cats, ["2026-01", "2026-03"], "Mercado");
    expect(f.map((x) => [x.totalEntradas, x.totalSaidas])).toEqual([
      [0, 300_00],
      [0, 600_00],
    ]);
  });
});

describe("patrimonioPrevisto", () => {
  // Out: realizado 49.063,78 · Nov: entradas 10.326,07 (8.495,81 prev) e saídas 7.050,18 (1.346,56 prev) · Dez: 10.300 entradas (prev) − 4.001,50 saídas (1.524,62 prev)
  const mes = (ep: number, sp: number, e: number, sa: number) => ({
    entradas: { previsto: ep },
    saidas: { previsto: sp },
    resultado: e - sa,
  });
  const linhas = [
    mes(0, 0, 12630_77, 7919_17),
    mes(8495_81, 1346_56, 10326_07, 7050_18),
    mes(10300_00, 1524_62, 10300_00, 4001_50),
  ];
  it("mês realizado: realizado + previsto acumulado; futuro: encadeia o resultado", () => {
    const r = patrimonioPrevisto(linhas, [49063_78, 45190_42, null], 40000_00);
    expect(r[0]).toEqual({ previsto: 49063_78, atual: 49063_78 });
    expect(r[1]).toEqual({ previsto: 45190_42 + 8495_81 - 1346_56, atual: 45190_42 });
    expect(r[1]!.previsto).toBe(49063_78 + 10326_07 - 7050_18); // = mês anterior + resultado do mês (o que o usuário espera ver)
    expect(r[2]!).toEqual({
      previsto: (r[1]!.previsto as number) + 10300_00 - 4001_50,
      atual: null,
    });
  });
  it("sem base nem realizado → null; ano futuro parte da base", () => {
    expect(patrimonioPrevisto(linhas, [null, null, null], null).map((x) => x.previsto)).toEqual([
      null,
      null,
      null,
    ]);
    expect(patrimonioPrevisto(linhas.slice(0, 1), [null], 100_00)[0]!.previsto).toBe(
      100_00 + 12630_77 - 7919_17,
    );
  });
});

describe("empilharPorMes com várias categorias", () => {
  const cats = [cat("Mercado", "saida"), cat("Casa", "saida"), cat("Lazer", "saida")];
  const itens = [
    it_("2026-01", "saida", 300_00, "Mercado"),
    it_("2026-01", "saida", 50_00, "Casa"),
    it_("2026-01", "saida", 70_00, "Lazer"),
  ];
  it("aceita lista de categorias; lista vazia = todas", () => {
    expect(empilharPorMes(itens, cats, ["2026-01"], [])[0]!.totalSaidas).toBe(420_00);
    expect(empilharPorMes(itens, cats, ["2026-01"], ["Mercado", "Casa"])[0]!.totalSaidas).toBe(
      350_00,
    );
  });
});
