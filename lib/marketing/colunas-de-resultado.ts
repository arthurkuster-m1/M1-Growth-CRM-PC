/**
 * AS COLUNAS DE RESULTADO de uma campanha (Dia a dia e página Resultados): os mesmos números, no
 * mesmo cálculo, escolhidos e ordenados por quem olha. Cada coluna é uma função do AGREGADO (a
 * soma de um dia, de uma campanha ou do período inteiro): o total do fim da tabela é a mesma conta
 * feita sobre a soma, nunca a soma das taxas.
 */
export interface Agregado {
  impressoes: number;
  cliques: number;
  visitas: number;
  leads: number;
  investido: number;
  agendamentos: number;
  reunioes: number;
  vendas: number;
  /** O valor total das vendas fechadas (primeira parcela recebida no período). */
  faturamento: number;
  /** O dinheiro que de fato caiu (parcelas recebidas). */
  recebido: number;
  /** O que está comprometido com vencimento no período. */
  aReceber: number;
}

export const AGREGADO_VAZIO: Agregado = {
  impressoes: 0,
  cliques: 0,
  visitas: 0,
  leads: 0,
  investido: 0,
  agendamentos: 0,
  reunioes: 0,
  vendas: 0,
  faturamento: 0,
  recebido: 0,
  aReceber: 0,
};

export function somarAgregados(lista: readonly Agregado[]): Agregado {
  const total = { ...AGREGADO_VAZIO };
  for (const a of lista) {
    for (const k of Object.keys(total) as Array<keyof Agregado>) total[k] += a[k];
  }
  return total;
}

/** O agregado de UM dia do dia a dia (os números do CRM vêm em `extras.crm_*`). */
export function agregadoDoDia(d: {
  impressions: number;
  link_clicks: number;
  lp_views: number;
  leads: number;
  spend: number;
  extras?: Record<string, number>;
}): Agregado {
  const x = d.extras ?? {};
  return {
    impressoes: d.impressions,
    cliques: d.link_clicks,
    visitas: d.lp_views,
    leads: d.leads,
    investido: d.spend,
    agendamentos: x.crm_agendamentos ?? 0,
    reunioes: x.crm_reunioes ?? 0,
    vendas: x.crm_vendas ?? 0,
    faturamento: x.crm_faturamento ?? 0,
    recebido: x.crm_recebido ?? 0,
    aReceber: x.crm_a_receber ?? 0,
  };
}

export type FormatoDaColuna = "inteiro" | "moeda" | "pct" | "x";

export interface ColunaDeResultado {
  id: string;
  /** O rótulo em português (a tela passa por `t`). */
  rotulo: string;
  formato: FormatoDaColuna;
  valor: (a: Agregado) => number | null;
  /** Nas campanhas de anúncio, aparece de fábrica. */
  padrao: boolean;
}

const razao = (n: number, d: number, k = 1): number | null => (d > 0 ? (n / d) * k : null);
const custo = (inv: number, n: number): number | null => (inv > 0 && n > 0 ? inv / n : null);

export const COLUNAS_DE_RESULTADO: readonly ColunaDeResultado[] = [
  { id: "impressoes", rotulo: "Impressões", formato: "inteiro", valor: (a) => a.impressoes, padrao: true },
  { id: "cliques", rotulo: "Cliques no link", formato: "inteiro", valor: (a) => a.cliques, padrao: true },
  { id: "visitas", rotulo: "Visitas à LP", formato: "inteiro", valor: (a) => a.visitas, padrao: true },
  { id: "leads", rotulo: "Leads (CRM)", formato: "inteiro", valor: (a) => a.leads, padrao: true },
  { id: "investido", rotulo: "Investido", formato: "moeda", valor: (a) => a.investido, padrao: true },
  { id: "cpm", rotulo: "CPM", formato: "moeda", valor: (a) => razao(a.investido, a.impressoes, 1000), padrao: false },
  { id: "ctr", rotulo: "CTR", formato: "pct", valor: (a) => razao(a.cliques, a.impressoes, 100), padrao: false },
  { id: "cpc", rotulo: "CPC", formato: "moeda", valor: (a) => custo(a.investido, a.cliques), padrao: false },
  { id: "cpv", rotulo: "CPV (custo por visita à LP)", formato: "moeda", valor: (a) => custo(a.investido, a.visitas), padrao: false },
  { id: "cpl", rotulo: "CPL", formato: "moeda", valor: (a) => custo(a.investido, a.leads), padrao: true },
  { id: "conversao_lp", rotulo: "Conversão da LP", formato: "pct", valor: (a) => razao(a.leads, a.visitas, 100), padrao: false },
  { id: "agendamentos", rotulo: "Agendamentos", formato: "inteiro", valor: (a) => a.agendamentos, padrao: false },
  { id: "custo_agendamento", rotulo: "Custo por agendamento", formato: "moeda", valor: (a) => custo(a.investido, a.agendamentos), padrao: false },
  { id: "reunioes", rotulo: "Reuniões feitas", formato: "inteiro", valor: (a) => a.reunioes, padrao: false },
  { id: "comparecimento", rotulo: "Taxa de comparecimento", formato: "pct", valor: (a) => razao(a.reunioes, a.agendamentos, 100), padrao: false },
  { id: "vendas", rotulo: "Vendas", formato: "inteiro", valor: (a) => a.vendas, padrao: true },
  { id: "cac", rotulo: "CAC", formato: "moeda", valor: (a) => custo(a.investido, a.vendas), padrao: false },
  { id: "faturamento", rotulo: "Faturamento (vendas fechadas)", formato: "moeda", valor: (a) => a.faturamento, padrao: false },
  { id: "recebido", rotulo: "Recebido", formato: "moeda", valor: (a) => a.recebido, padrao: true },
  { id: "a_receber", rotulo: "A receber", formato: "moeda", valor: (a) => a.aReceber, padrao: false },
  { id: "ticket", rotulo: "Ticket médio", formato: "moeda", valor: (a) => razao(a.faturamento, a.vendas), padrao: false },
  { id: "lucro", rotulo: "Lucro", formato: "moeda", valor: (a) => (a.recebido > 0 || a.investido > 0 ? a.recebido - a.investido : null), padrao: false },
  { id: "roas", rotulo: "ROAS", formato: "x", valor: (a) => (a.investido > 0 && a.recebido > 0 ? a.recebido / a.investido : null), padrao: false },
];

export function formatarResultado(formato: FormatoDaColuna, v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (formato === "moeda") return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (formato === "pct") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (formato === "x") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`;
  return Math.round(v).toLocaleString("pt-BR");
}

/** A ordem e as colunas salvas, sem perder as que foram criadas depois. */
export function ordemDasColunas(
  salva: readonly string[] | undefined,
  validos: readonly string[],
): string[] {
  const ok = (salva ?? []).filter((id) => validos.includes(id));
  return [...ok, ...validos.filter((id) => !ok.includes(id))];
}
