import type { Categoria, Conta, Lancamento } from "./tipos";
import { mesSeguinte } from "./formato";

/**
 * Histórico por mês (Visão geral e Visão do ano) — função pura.
 * Mesma regra da Visão do mês: compra de cartão entra pelo mês da FATURA, estorno de cartão abate, transferência nunca conta,
 * categorias do grupo Sistema (ajustes automáticos) ficam fora. "Previsto" = status pendente; "pago" = realizado.
 */
export type ItemHistorico = {
  id: string;
  mes: string;
  tipo: "entrada" | "saida";
  valor: number;
  previsto: boolean;
  categoriaId: string | null;
};
export type MesResumo = {
  mes: string;
  entradas: { pago: number; previsto: number; total: number };
  saidas: { pago: number; previsto: number; total: number };
  resultado: number;
};
export type TotalCategoria = {
  categoriaId: string | null;
  nome: string;
  cor: number | null;
  pago: number;
  previsto: number;
  total: number;
  orcamentoAnual: number;
  orcamentoMensal: number;
};

export function itensDoHistorico(a: {
  contas: Conta[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  de: string;
  ate: string;
}): ItemHistorico[] {
  const cartoes = new Set(a.contas.filter((c) => c.tipo === "cartao").map((c) => c.id));
  const sistema = new Set(a.categorias.filter((c) => c.grupo === "Sistema").map((c) => c.id));
  const vistos = new Set<string>();
  const out: ItemHistorico[] = [];
  for (const l of a.lancamentos) {
    if (vistos.has(l.id)) continue;
    vistos.add(l.id);
    if (l.status === "cancelado" || l.tipo === "transferencia") continue;
    if (l.category_id && sistema.has(l.category_id)) continue;
    const noCartao = !!l.account_id && cartoes.has(l.account_id);
    if (noCartao && !l.fatura_mes) continue;
    const mes = (noCartao ? l.fatura_mes! : l.data).slice(0, 7);
    if (mes < a.de || mes >= a.ate) continue;
    // estorno de cartão (entrada no cartão) abate a saída em vez de virar renda
    const tipo = noCartao ? "saida" : l.tipo;
    const valor = noCartao && l.tipo === "entrada" ? -l.valor_cents : l.valor_cents;
    out.push({
      id: l.id,
      mes,
      tipo,
      valor,
      previsto: l.status === "pendente",
      categoriaId: l.category_id,
    });
  }
  return out;
}

export function listaDeMeses(de: string, ate: string): string[] {
  const m: string[] = [];
  for (let x = de; x < ate && m.length < 120; x = mesSeguinte(x)) m.push(x);
  return m;
}

export function resumoPorMes(itens: ItemHistorico[], meses: string[]): MesResumo[] {
  return meses.map((mes) => {
    const soma = (tipo: "entrada" | "saida", previsto: boolean) =>
      itens
        .filter((i) => i.mes === mes && i.tipo === tipo && i.previsto === previsto)
        .reduce((s, i) => s + i.valor, 0);
    const e = { pago: soma("entrada", false), previsto: soma("entrada", true), total: 0 };
    e.total = e.pago + e.previsto;
    const s = { pago: soma("saida", false), previsto: soma("saida", true), total: 0 };
    s.total = s.pago + s.previsto;
    return { mes, entradas: e, saidas: s, resultado: e.total - s.total };
  });
}

export function totaisPorCategoria(
  itens: ItemHistorico[],
  tipo: "entrada" | "saida",
  categorias: Categoria[],
  mesesNoPeriodo: number,
): TotalCategoria[] {
  const cats = new Map(categorias.map((c) => [c.id, c]));
  const m = new Map<string | null, TotalCategoria>();
  for (const i of itens) {
    if (i.tipo !== tipo) continue;
    const c = i.categoriaId ? cats.get(i.categoriaId) : undefined;
    const t = m.get(i.categoriaId) ?? {
      categoriaId: i.categoriaId,
      nome: c?.nome ?? "Sem categoria",
      cor: c?.cor ?? null,
      pago: 0,
      previsto: 0,
      total: 0,
      orcamentoAnual: 0,
      orcamentoMensal: c?.orcamento_mensal_cents ?? 0,
    };
    if (i.previsto) t.previsto += i.valor;
    else t.pago += i.valor;
    t.total = t.pago + t.previsto;
    m.set(i.categoriaId, t);
  }
  return [...m.values()]
    .map((t) => {
      const c = t.categoriaId ? cats.get(t.categoriaId) : undefined;
      // orçamento do período: o anual, se existir; senão o mensal × meses do período
      return {
        ...t,
        orcamentoAnual: c
          ? c.orcamento_anual_cents > 0
            ? c.orcamento_anual_cents
            : c.orcamento_mensal_cents * mesesNoPeriodo
          : 0,
      };
    })
    .filter((t) => t.total !== 0)
    .sort((a, b) => b.total - a.total);
}

/** Média dos últimos `n` meses FECHADOS (antes do mês atual) em que houve movimento realizado; null se não há histórico. */
export function mediaMensal(
  linhas: MesResumo[],
  mesAtual: string,
  n = 6,
): { saidas: number; entradas: number; resultado: number; meses: number } | null {
  const fechados = linhas
    .filter((l) => l.mes < mesAtual && (l.saidas.pago !== 0 || l.entradas.pago !== 0))
    .slice(-n);
  if (fechados.length === 0) return null;
  const media = (f: (l: MesResumo) => number) =>
    Math.round(fechados.reduce((s, l) => s + f(l), 0) / fechados.length);
  return {
    saidas: media((l) => l.saidas.pago),
    entradas: media((l) => l.entradas.pago),
    resultado: media((l) => l.entradas.pago - l.saidas.pago),
    meses: fechados.length,
  };
}

/** Média dos `n` meses do calendário ANTES do mês atual (meses sem movimento contam como zero). null se nenhum deles teve movimento. */
export function mediaJanela(
  linhas: MesResumo[],
  mesAtual: string,
  n = 4,
): { saidas: number; entradas: number; resultado: number; de: string; ate: string } | null {
  const meses: string[] = [];
  let m = mesAtual;
  for (let i = 0; i < n; i++) {
    const [a = 0, x = 0] = m.split("-").map(Number);
    m = x === 1 ? `${a - 1}-12` : `${a}-${String(x - 1).padStart(2, "0")}`;
    meses.unshift(m);
  }
  const por = new Map(linhas.map((l) => [l.mes, l]));
  const js = meses.map((x) => por.get(x));
  if (!js.some((l) => l && (l.saidas.pago !== 0 || l.entradas.pago !== 0))) return null;
  const media = (f: (l: MesResumo) => number) =>
    Math.round(js.reduce((t, l) => t + (l ? f(l) : 0), 0) / n);
  return {
    saidas: media((l) => l.saidas.pago),
    entradas: media((l) => l.entradas.pago),
    resultado: media((l) => l.entradas.pago - l.saidas.pago),
    de: meses[0]!,
    ate: meses[n - 1]!,
  };
}
