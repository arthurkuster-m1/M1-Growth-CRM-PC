import type { Categoria } from "./tipos";
import type { ItemHistorico } from "./historico";
import { anualEfetivo } from "./orcamentos";

/** Cálculos da Visão do ano que dependem de categoria: detalhe por categoria e barras empilhadas por mês. Funções puras. */
export type DetalheCategoria = {
  id: string | null;
  nome: string;
  cor: number | null;
  grupoId: string | null;
  tipo: "entrada" | "saida";
  ativa: boolean;
  total: number;
  pago: number;
  previsto: number;
  media: number;
  /** valor de cada mês do ano (índice 0 = janeiro) */ porMes: number[];
  maiorMes: { mes: number; valor: number } | null;
  /** orçamento (ou meta) do ano e quanto dele já foi usado (0–n); null se não há orçamento */ orcamentoAno: number;
  usado: number | null;
};

/**
 * Quantos meses entram nas médias do ano: de janeiro até o ÚLTIMO mês com lançamento (pago OU previsto). Meses depois disso, ainda sem
 * nada cadastrado, não entram na divisão (só lançamentos até setembro → 9). Mês vazio no meio do período conta. 0 = sem lançamentos.
 * `lado` restringe a entradas ou a saídas (ex.: média das entradas só considera meses com entrada cadastrada).
 */
export function mesesComInformacao(
  linhas: { mes: string; entradas: { total: number }; saidas: { total: number } }[],
  lado?: "entradas" | "saidas",
): number {
  let n = 0;
  linhas.forEach((l, i) => {
    if (
      (lado !== "saidas" && l.entradas.total !== 0) ||
      (lado !== "entradas" && l.saidas.total !== 0)
    )
      n = i + 1;
  });
  return n;
}

export function detalharCategorias(
  itens: ItemHistorico[],
  categorias: Categoria[],
  meses: number,
): DetalheCategoria[] {
  const porId = new Map<string | null, DetalheCategoria>();
  const novo = (
    c: Categoria | undefined,
    id: string | null,
    tipo: "entrada" | "saida",
  ): DetalheCategoria => ({
    id,
    nome: c?.nome ?? "Sem categoria",
    cor: c?.cor ?? null,
    grupoId: c?.group_id ?? null,
    tipo,
    ativa: c?.ativa ?? true,
    total: 0,
    pago: 0,
    previsto: 0,
    media: 0,
    porMes: Array(12).fill(0),
    maiorMes: null,
    orcamentoAno: c ? anualEfetivo(c) : 0,
    usado: null,
  });
  for (const c of categorias) if (c.grupo !== "Sistema") porId.set(c.id, novo(c, c.id, c.tipo));
  const cats = new Map(categorias.map((c) => [c.id, c]));
  for (const i of itens) {
    const chave = i.categoriaId && cats.has(i.categoriaId) ? i.categoriaId : null;
    if (!porId.has(chave)) porId.set(chave, novo(undefined, null, i.tipo));
    const d = porId.get(chave)!;
    if (d.tipo !== i.tipo && chave !== null) continue;
    d.porMes[Number(i.mes.slice(5, 7)) - 1]! += i.valor;
    if (i.previsto) d.previsto += i.valor;
    else d.pago += i.valor;
    d.total = d.pago + d.previsto;
  }
  return [...porId.values()].map((d) => {
    const maior = d.porMes.reduce((m, v, k) => (v > m.valor ? { mes: k + 1, valor: v } : m), {
      mes: 0,
      valor: 0,
    });
    return {
      ...d,
      media: Math.round(d.total / Math.max(meses, 1)),
      maiorMes: maior.valor > 0 ? maior : null,
      usado: d.orcamentoAno > 0 ? d.total / d.orcamentoAno : null,
    };
  });
}

export type Segmento = {
  categoriaId: string | null;
  nome: string;
  cor: number | null;
  pago: number;
  previsto: number;
};
export type MesEmpilhado = {
  mes: string;
  entradas: Segmento[];
  saidas: Segmento[];
  totalEntradas: number;
  totalSaidas: number;
  lucro: number;
};

/** Barras empilhadas por mês: cada barra é dividida por categoria (fonte, nas entradas). `filtro` mostra só uma categoria. */
export function empilharPorMes(
  itens: ItemHistorico[],
  categorias: Categoria[],
  meses: string[],
  filtro: string | string[] | null,
): MesEmpilhado[] {
  const alvo = filtro === null ? null : new Set(Array.isArray(filtro) ? filtro : [filtro]);
  const cats = new Map(categorias.map((c) => [c.id, c]));
  return meses.map((mes) => {
    const lado = (tipo: "entrada" | "saida"): Segmento[] => {
      const m = new Map<string | null, Segmento>();
      for (const i of itens) {
        if (i.mes !== mes || i.tipo !== tipo) continue;
        if (alvo && alvo.size > 0 && !(i.categoriaId && alvo.has(i.categoriaId))) continue;
        const c = i.categoriaId ? cats.get(i.categoriaId) : undefined;
        const s = m.get(i.categoriaId) ?? {
          categoriaId: i.categoriaId,
          nome: c?.nome ?? "Sem categoria",
          cor: c?.cor ?? null,
          pago: 0,
          previsto: 0,
        };
        if (i.previsto) s.previsto += i.valor;
        else s.pago += i.valor;
        m.set(i.categoriaId, s);
      }
      return [...m.values()]
        .filter((s) => s.pago + s.previsto > 0)
        .sort((a, b) => b.pago + b.previsto - (a.pago + a.previsto));
    };
    const entradas = lado("entrada"),
      saidas = lado("saida");
    const soma = (l: Segmento[]) => l.reduce((a, s) => a + s.pago + s.previsto, 0);
    return {
      mes,
      entradas,
      saidas,
      totalEntradas: soma(entradas),
      totalSaidas: soma(saidas),
      lucro: soma(entradas) - soma(saidas),
    };
  });
}

export type GrupoDetalhe = {
  grupoId: string | null;
  nome: string;
  categorias: DetalheCategoria[];
  total: number;
  /** parte de `total` que ainda é prevista */ previsto: number;
  media: number;
  orcamentoAno: number;
  usado: number | null;
};

/** Agrupa as categorias pelos grupos cadastrados (na ordem dos grupos); sem grupo vai por último. */
export function agruparDetalhes(
  detalhes: DetalheCategoria[],
  grupos: { id: string; nome: string }[],
  meses: number,
): GrupoDetalhe[] {
  const monta = (grupoId: string | null, nome: string, lista: DetalheCategoria[]): GrupoDetalhe => {
    const total = lista.reduce((a, d) => a + d.total, 0);
    const comOrc = lista.filter((d) => d.orcamentoAno > 0);
    const orcamentoAno = comOrc.reduce((a, d) => a + d.orcamentoAno, 0);
    return {
      grupoId,
      nome,
      categorias: lista,
      total,
      previsto: lista.reduce((a, d) => a + d.previsto, 0),
      media: Math.round(total / Math.max(meses, 1)),
      orcamentoAno,
      usado: orcamentoAno > 0 ? comOrc.reduce((a, d) => a + d.total, 0) / orcamentoAno : null,
    };
  };
  const ids = new Set(grupos.map((g) => g.id));
  const out = grupos
    .map((g) =>
      monta(
        g.id,
        g.nome,
        detalhes.filter((d) => d.grupoId === g.id),
      ),
    )
    .filter((g) => g.categorias.length > 0);
  const sem = detalhes.filter((d) => !d.grupoId || !ids.has(d.grupoId));
  if (sem.length) out.push(monta(null, "Sem grupo", sem));
  return out;
}

/**
 * Patrimônio PREVISTO no fim de cada mês do ano.
 * Mês que já tem patrimônio realizado: realizado + tudo o que ainda é só previsto até ele (entradas − saídas previstas acumuladas).
 * Mês futuro (sem realizado): o previsto do mês anterior + o resultado do mês (pago + previsto). `base` = realizado no fim do ano anterior.
 * `atual` é o realizado (null nos meses futuros).
 */
export function patrimonioPrevisto(
  linhas: { entradas: { previsto: number }; saidas: { previsto: number }; resultado: number }[],
  realizado: (number | null)[],
  base: number | null,
): { previsto: number | null; atual: number | null }[] {
  let acum = 0;
  let anterior: number | null = base;
  return linhas.map((l, i) => {
    acum += l.entradas.previsto - l.saidas.previsto;
    const r = realizado[i] ?? null;
    const previsto = r !== null ? r + acum : anterior !== null ? anterior + l.resultado : null;
    anterior = previsto;
    return { previsto, atual: r };
  });
}
