import type { Categoria } from "./tipos";

/**
 * Orçamentos (saídas) e metas de ganho (entradas) POR ANO.
 * - Ano com registro próprio: vale o dele (mesmo que seja zero: "este ano não tem meta").
 * - Ano sem registro: herda o último ano anterior que tinha (a meta "atualiza todo ano" sem sumir em janeiro).
 * - Ano ANTES do primeiro registro de todos: sem orçamento (quem começou em 2026 não ganha meta retroativa).
 */
export type OrcamentoAno = {
  category_id: string;
  ano: number;
  mensal_cents: number;
  anual_cents: number;
};
export type OrcamentoEfetivo = {
  mensal: number;
  anual: number;
  /** de que ano veio, quando herdado */ herdadoDe: number | null;
  /** existe algum valor aplicável neste ano */ aplicavel: boolean;
};

export function primeiroAno(rows: OrcamentoAno[]): number | null {
  return rows.length ? Math.min(...rows.map((r) => r.ano)) : null;
}

export function orcamentoDe(
  rows: OrcamentoAno[],
  categoriaId: string,
  ano: number,
): OrcamentoEfetivo {
  const inicio = primeiroAno(rows);
  if (inicio === null || ano < inicio)
    return { mensal: 0, anual: 0, herdadoDe: null, aplicavel: false };
  const dela = rows
    .filter((r) => r.category_id === categoriaId && r.ano <= ano)
    .sort((a, b) => b.ano - a.ano)[0];
  if (!dela) return { mensal: 0, anual: 0, herdadoDe: null, aplicavel: true };
  return {
    mensal: dela.mensal_cents,
    anual: dela.anual_cents,
    herdadoDe: dela.ano === ano ? null : dela.ano,
    aplicavel: true,
  };
}

/** As categorias com os valores de orçamento/meta DAQUELE ano (é o que as telas e os cálculos já esperam). */
export function categoriasDoAno(
  categorias: Categoria[],
  rows: OrcamentoAno[],
  ano: number,
): Categoria[] {
  return categorias.map((c) => {
    const o = orcamentoDe(rows, c.id, ano);
    return { ...c, orcamento_mensal_cents: o.mensal, orcamento_anual_cents: o.anual };
  });
}

/** Referência mensal: o valor do mês, ou o anual ÷ 12 quando só há anual. */
export const mensalEfetivo = (
  c: Pick<Categoria, "orcamento_mensal_cents" | "orcamento_anual_cents">,
) =>
  c.orcamento_mensal_cents > 0
    ? c.orcamento_mensal_cents
    : Math.round(c.orcamento_anual_cents / 12);
/** Teto do ano: o anual, ou o mensal × 12 quando só há mensal. */
export const anualEfetivo = (
  c: Pick<Categoria, "orcamento_mensal_cents" | "orcamento_anual_cents">,
) => (c.orcamento_anual_cents > 0 ? c.orcamento_anual_cents : c.orcamento_mensal_cents * 12);
/** Categoria cujo orçamento só existe no ano: o mês é flexível, o que vale é fechar o ano dentro. */
export const soAnual = (c: Pick<Categoria, "orcamento_mensal_cents" | "orcamento_anual_cents">) =>
  c.orcamento_mensal_cents <= 0 && c.orcamento_anual_cents > 0;

/**
 * Quanto ainda pode gastar NESTE mês numa categoria só-anual: o que sobra do ano (descontando o gasto dos meses anteriores)
 * dividido pelos meses que faltam, contando o atual. Um mês que estoura é compensado nos seguintes; nunca fica negativo.
 */
export function permitidoNoMes(anual: number, gastoAntes: number, mesesRestantes: number): number {
  return Math.max(0, Math.round((anual - gastoAntes) / Math.max(mesesRestantes, 1)));
}
