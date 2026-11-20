/** Teto de gastos do mês: um valor padrão para todos os meses + exceções por mês ("AAAA-MM"). */
export type PlanoTeto = { tetoPadrao: number; tetos: Record<string, number> };
export type TetoResolvido = { valor: number; origem: "mes" | "padrao" | "nenhum" };

export function tetoDoMes(p: PlanoTeto, mes: string): TetoResolvido {
  const proprio = p.tetos[mes];
  if (proprio !== undefined) return { valor: proprio, origem: "mes" };
  return p.tetoPadrao > 0
    ? { valor: p.tetoPadrao, origem: "padrao" }
    : { valor: 0, origem: "nenhum" };
}

/** Soma dos 12 tetos do ano (cada mês vale o seu, ou o padrão) — para comparar com a soma dos orçamentos por categoria. */
export function tetoDoAno(p: PlanoTeto, ano: number): number {
  let t = 0;
  for (let m = 1; m <= 12; m++) t += tetoDoMes(p, `${ano}-${String(m).padStart(2, "0")}`).valor;
  return t;
}

/** Meta de ganhos do mês: mesma forma do teto — um padrão para todos os meses + exceções por mês. */
export type PlanoMeta = { metaPadrao: number; metas: Record<string, number> };
export function metaDoMes(p: PlanoMeta, mes: string): TetoResolvido {
  return tetoDoMes({ tetoPadrao: p.metaPadrao, tetos: p.metas }, mes);
}
