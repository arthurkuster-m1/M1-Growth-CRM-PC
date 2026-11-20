import type { Categoria, Conta, Lancamento } from "./tipos";
import { itensDoHistorico } from "./historico";

/** Comparação entre dois anos — funções puras. Valores cheios (pagos + previstos); cartão pelo mês da fatura; transferência nunca é entrada/saída. */
export type MetricasAno = {
  ano: number;
  entradas: number;
  saidas: number;
  resultado: number;
  mediaEntradas: number;
  mediaSaidas: number;
  aportes: number;
  patrimonio: number | null;
  meses: number;
};

export function metricasDoAno(a: {
  ano: number;
  hoje: string;
  contas: Conta[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  patrimonioFim: number | null;
}): MetricasAno {
  const itens = itensDoHistorico({
    contas: a.contas,
    categorias: a.categorias,
    lancamentos: a.lancamentos,
    de: `${a.ano}-01`,
    ate: `${a.ano + 1}-01`,
  });
  const soma = (t: "entrada" | "saida") =>
    itens.filter((i) => i.tipo === t).reduce((s, i) => s + i.valor, 0);
  const entradas = soma("entrada"),
    saidas = soma("saida");
  const invest = new Set(a.contas.filter((c) => c.tipo === "investida").map((c) => c.id));
  let aportes = 0;
  const visto = new Set<string>();
  for (const l of a.lancamentos) {
    if (visto.has(l.id)) continue;
    visto.add(l.id);
    if (l.tipo !== "transferencia" || l.status === "cancelado" || !l.data.startsWith(String(a.ano)))
      continue;
    const entra = !!l.account_destino_id && invest.has(l.account_destino_id),
      sai = !!l.account_id && invest.has(l.account_id);
    if (entra && !sai) aportes += l.valor_cents;
    else if (sai && !entra) aportes -= l.valor_cents;
  }
  // médias: de janeiro até o último mês com lançamento (pago ou previsto) (meses futuros, sem nada cadastrado, não entram na divisão)
  const meses = Math.max(
    itens.reduce((m, i) => (i.valor !== 0 ? Math.max(m, Number(i.mes.slice(5, 7))) : m), 0),
    1,
  );
  return {
    ano: a.ano,
    entradas,
    saidas,
    resultado: entradas - saidas,
    mediaEntradas: Math.round(entradas / meses),
    mediaSaidas: Math.round(saidas / meses),
    aportes,
    patrimonio: a.patrimonioFim,
    meses,
  };
}

export type LinhaComparacao = {
  chave: string;
  rotulo: string;
  a: number | null;
  b: number | null;
  dif: number | null;
  pct: number | null;
  /** true = subir é bom */ bomSubir: boolean | null;
};
const par = (
  chave: string,
  rotulo: string,
  a: number | null,
  b: number | null,
  bomSubir: boolean | null,
): LinhaComparacao => {
  const dif = a !== null && b !== null ? b - a : null;
  return {
    chave,
    rotulo,
    a,
    b,
    dif,
    pct: dif !== null && a ? (dif / Math.abs(a)) * 100 : null,
    bomSubir,
  };
};
/** `a` = ano-base, `b` = ano comparado: dif e % dizem quanto b mudou em relação a a. */
export function compararAnos(a: MetricasAno, b: MetricasAno): LinhaComparacao[] {
  return [
    par("entradas", "Entradas", a.entradas, b.entradas, true),
    par("saidas", "Saídas (custo de vida)", a.saidas, b.saidas, false),
    par("resultado", "Resultado (entradas − saídas)", a.resultado, b.resultado, true),
    par("mediaEntradas", "Ganho médio por mês", a.mediaEntradas, b.mediaEntradas, true),
    par("mediaSaidas", "Gasto médio por mês", a.mediaSaidas, b.mediaSaidas, false),
    par("aportes", "Investido no ano (aportes)", a.aportes, b.aportes, true),
    par("patrimonio", "Patrimônio no fim do ano", a.patrimonio, b.patrimonio, true),
  ];
}
