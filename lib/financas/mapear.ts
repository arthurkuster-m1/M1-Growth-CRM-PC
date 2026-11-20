import type { Categoria, Conta, GrupoCategoria } from "./tipos";

/** Linhas do banco (`fin_*`) → o formato que o cálculo da família consome. Puro: só renomeia e completa. */
type LinhaDeConta = Omit<Conta, "rendimento_pct"> & { rendimento_pct: number | string | null };
type LinhaDeCategoria = Omit<Categoria, "grupo" | "orcamento_anual_cents">;

export function mapearContas(linhas: readonly LinhaDeConta[]): Conta[] {
  return linhas.map((c) => ({
    ...c,
    // numeric(7,4) chega como texto em alguns clientes
    rendimento_pct: c.rendimento_pct === null ? null : Number(c.rendimento_pct),
  }));
}

/** `grupo` é o NOME do grupo (o cálculo exclui o grupo "Sistema" pelo nome); o orçamento anual não existe aqui (zero). */
export function mapearCategorias(
  linhas: readonly LinhaDeCategoria[],
  grupos: readonly GrupoCategoria[],
): Categoria[] {
  const nomeDe = new Map(grupos.map((g) => [g.id, g.nome]));
  return linhas.map((c) => ({
    ...c,
    orcamento_mensal_cents: Number(c.orcamento_mensal_cents),
    orcamento_anual_cents: 0,
    grupo: c.group_id ? (nomeDe.get(c.group_id) ?? null) : null,
  }));
}
