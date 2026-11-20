import type { DetalheCategoria, GrupoDetalhe } from "./anual";

/** Tabela da Visão do ano (grupos → categorias, mês a mês, comparação) — funções puras. */
export type ColunaTabela = "nome" | "total" | "media" | "pct" | "orcamento" | "uso" | "maior";
export type SentidoOrdem = "asc" | "desc";
type Base = {
  nome: string;
  total: number;
  media: number;
  orcamentoAno: number;
  maiorMes?: { mes: number; valor: number } | null;
  /** quanto do orçamento do ano já foi consumido (1 = 100%); null = sem orçamento */ usado?:
    number | null;
};

export const chaveCat = (id: string | null) => `cat:${id ?? "sem"}`;
export const chaveGrupo = (id: string | null) => `grp:${id ?? "sem"}`;

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Soma mês a mês das categorias do grupo (índice 0 = janeiro). */
export function porMesDoGrupo(g: GrupoDetalhe): number[] {
  return Array.from({ length: 12 }, (_, m) => g.categorias.reduce((a, c) => a + c.porMes[m]!, 0));
}

/** % do total geral; coluna "pct" ordena pelo total (mesma ordem). */
export function ordenar<T extends Base>(lista: T[], col: ColunaTabela, dir: SentidoOrdem): T[] {
  const chave = (x: T): string | number => {
    switch (col) {
      case "nome":
        return x.nome;
      case "total":
      case "pct":
        return x.total;
      case "media":
        return x.media;
      case "orcamento":
        return x.orcamentoAno;
      case "uso":
        return x.usado ?? 0;
      case "maior":
        return x.maiorMes?.valor ?? 0;
    }
  };
  const f = dir === "asc" ? 1 : -1;
  return [...lista].sort((a, b) => {
    // sem orçamento não tem % consumido: vai sempre para o fim, em qualquer sentido
    if (col === "uso" && ((a.usado ?? null) === null) !== ((b.usado ?? null) === null))
      return (a.usado ?? null) === null ? 1 : -1;
    const x = chave(a),
      y = chave(b);
    return (
      f *
      (typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "pt-BR", { numeric: true, sensitivity: "base" }))
    );
  });
}

/** Busca por nome de categoria ou de grupo. Grupo que casa mostra todas as categorias; senão, só as que casam. */
export function filtrarGrupos(grupos: GrupoDetalhe[], termo: string): GrupoDetalhe[] {
  const ts = norm(termo).split(/\s+/).filter(Boolean);
  if (ts.length === 0) return grupos;
  const casa = (nome: string) => ts.every((t) => norm(nome).includes(t));
  return grupos.flatMap((g) => {
    if (casa(g.nome)) return [g];
    const cs = g.categorias.filter((c) => casa(c.nome));
    return cs.length ? [{ ...g, categorias: cs }] : [];
  });
}

export type CategoriaComGrupo = DetalheCategoria & { grupoNome: string };
export function achatar(grupos: GrupoDetalhe[]): CategoriaComGrupo[] {
  return grupos.flatMap((g) => g.categorias.map((c) => ({ ...c, grupoNome: g.nome })));
}

/** Série mês a mês de cada categoria e de cada grupo, pela chave (`cat:<id>` / `grp:<id>`). */
export function seriesPorChave(grupos: GrupoDetalhe[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const g of grupos) {
    m.set(chaveGrupo(g.grupoId), porMesDoGrupo(g));
    for (const c of g.categorias) m.set(chaveCat(c.id), c.porMes);
  }
  return m;
}

export type Serie = { chave: string; rotulo: string; porMes: number[]; total: number };
export const serie = (chave: string, rotulo: string, porMes: number[]): Serie => ({
  chave,
  rotulo,
  porMes,
  total: porMes.reduce((a, v) => a + v, 0),
});

/** b − a, mês a mês e no total; % sobre a (null quando a é zero). */
export function diferenca(
  a: Serie,
  b: Serie,
): { porMes: number[]; total: number; pct: number | null } {
  return {
    porMes: b.porMes.map((v, i) => v - a.porMes[i]!),
    total: b.total - a.total,
    pct: a.total ? ((b.total - a.total) / Math.abs(a.total)) * 100 : null,
  };
}
