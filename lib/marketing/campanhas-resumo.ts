import { z } from "zod";

import {
  investimentoLiquido,
  type CampanhaDeDemanda,
  type CanalDaCampanha,
} from "@/lib/marketing/campanhas";

/**
 * O RESUMO DA CAMPANHA (C2): a planilha de gestão do Arthur dentro do app. Tudo puro — recebe a
 * campanha e os dias e devolve os números (período, metas, pace de gastos, funil) e os alertas.
 * As fórmulas são as da planilha, conferidas com o print (docs/PLANO-CAMPANHAS-M1.md §3).
 */

export interface DiaDaCampanha {
  id?: string;
  day: string;
  impressions: number;
  reach: number;
  link_clicks: number;
  lp_views: number;
  leads: number;
  spend: number;
  extras: Record<string, number>;
  source: string;
}

export const COLUNAS_DO_DIA =
  "id, day, impressions, reach, link_clicks, lp_views, leads, spend, extras, source";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const contagem = z.number().int().min(0).max(2e9);

export const diaSchema = z.object({
  day: dia,
  impressions: contagem.default(0),
  reach: contagem.default(0),
  link_clicks: contagem.default(0),
  lp_views: contagem.default(0),
  leads: contagem.default(0),
  spend: z.number().finite().min(0).max(1e10).default(0),
  extras: z
    .record(z.string().regex(/^[a-z_]{1,40}$/), z.number().finite().min(0).max(1e10))
    .default({}),
});

export const MAXIMO_DE_DIAS_POR_ENVIO = 400;
export const gravarDiasSchema = z.object({
  dias: z.array(diaSchema).min(1).max(MAXIMO_DE_DIAS_POR_ENVIO),
  source: z.enum(["manual", "csv"]).default("manual"),
});

/** A linha do banco (numeric chega como texto) como `DiaDaCampanha`. */
export function diaDaLinha(l: Record<string, unknown>): DiaDaCampanha {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const extras: Record<string, number> = {};
  if (l.extras && typeof l.extras === "object" && !Array.isArray(l.extras)) {
    for (const [k, v] of Object.entries(l.extras as Record<string, unknown>)) {
      if (Number.isFinite(Number(v))) extras[k] = Number(v);
    }
  }
  return {
    id: typeof l.id === "string" ? l.id : undefined,
    day: String(l.day),
    impressions: n(l.impressions),
    reach: n(l.reach),
    link_clicks: n(l.link_clicks),
    lp_views: n(l.lp_views),
    leads: n(l.leads),
    spend: n(l.spend),
    extras,
    source: typeof l.source === "string" ? l.source : "manual",
  };
}

// ---------------------------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------------------------

const MS_DO_DIA = 86_400_000;
const emDias = (iso: string) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / MS_DO_DIA;

/** O dia de hoje (no fuso do navegador) como `AAAA-MM-DD`. */
export function hojeIso(agora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

export interface PeriodoDaCampanha {
  totais: number;
  passados: number;
  restantes: number;
}

/** Dias totais, passados e restantes — só existe com início e fim (e sem ser contínua). */
export function periodoDaCampanha(
  c: Pick<CampanhaDeDemanda, "start_date" | "end_date" | "continuous">,
  hoje: string,
): PeriodoDaCampanha | null {
  if (c.continuous || !c.start_date || !c.end_date) return null;
  const totais = emDias(c.end_date) - emDias(c.start_date) + 1;
  if (totais < 1) return null;
  const passados = Math.min(totais, Math.max(0, emDias(hoje) - emDias(c.start_date) + 1));
  return { totais, passados, restantes: totais - passados };
}

/** O investimento bruto do período todo, a partir do valor e do "vale por". */
export function investimentoBrutoTotal(
  c: Pick<CampanhaDeDemanda, "budget" | "budget_period">,
  totais: number,
): number | null {
  if (c.budget === null) return null;
  switch (c.budget_period) {
    case "total":
      return c.budget;
    case "diario":
      return c.budget * totais;
    case "semanal":
      return (c.budget * totais) / 7;
    case "mensal":
      return (c.budget * totais) / 30;
  }
}

// ---------------------------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------------------------

const razao = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export interface FunilDeTrafego {
  investido: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  visitas: number;
  leads: number;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null; // %
  custoPorVisita: number | null;
  connectionRate: number | null; // %
  cpl: number | null;
  conversaoDaLp: number | null; // %
}

export function funilDeTrafego(dias: readonly DiaDaCampanha[]): FunilDeTrafego {
  const soma = (f: (d: DiaDaCampanha) => number) => dias.reduce((s, d) => s + f(d), 0);
  const investido = Math.round(soma((d) => d.spend) * 100) / 100;
  const impressoes = soma((d) => d.impressions);
  const cliques = soma((d) => d.link_clicks);
  const visitas = soma((d) => d.lp_views);
  const leads = soma((d) => d.leads);
  const pct = (a: number, b: number) => {
    const r = razao(a, b);
    return r === null ? null : r * 100;
  };
  return {
    investido,
    impressoes,
    alcance: soma((d) => d.reach),
    cliques,
    visitas,
    leads,
    cpm: ((r) => (r === null ? null : r * 1000))(razao(investido, impressoes)),
    cpc: razao(investido, cliques),
    ctr: pct(cliques, impressoes),
    custoPorVisita: razao(investido, visitas),
    connectionRate: pct(visitas, cliques),
    cpl: razao(investido, leads),
    conversaoDaLp: pct(leads, visitas),
  };
}

export interface MetasDaCampanha {
  metaDeLeads: number | null;
  captados: number;
  faltam: number | null;
  metaDeCpl: number | null;
  cplNecessario: number | null;
  porDia: number | null;
  metaParaHoje: number | null;
  /** captados − meta de hoje: positivo = adiantado, negativo = atrasado. */
  adiantamento: number | null;
  novaMetaDiaria: number | null;
}

export interface PaceDeGastos {
  metaDiaria: number | null;
  mediaAtual: number | null;
  /** meta − média: positivo = está gastando abaixo do previsto. */
  diferenca: number | null;
  novoOrcamentoDiario: number | null;
}

export type CodigoDeAlerta =
  | "sem_periodo"
  | "orcamento_estourado"
  | "aumentar_orcamento"
  | "testar_criativos"
  | "conexao_da_lp"
  | "verificar_lp"
  | "cpl_acima_da_meta"
  | "leads_atrasados"
  | "no_ritmo";

export interface Alerta {
  codigo: CodigoDeAlerta;
  nivel: "atencao" | "info" | "ok";
  /** Um valor para compor a frase (ex.: o novo orçamento diário). */
  valor?: number;
}

export interface ResumoDaCampanha {
  periodo: PeriodoDaCampanha | null;
  investimentoBruto: number | null;
  investimentoLiquido: number | null;
  valorRestante: number | null;
  metas: MetasDaCampanha;
  pace: PaceDeGastos;
  funil: FunilDeTrafego;
  alertas: Alerta[];
}

// Os limites dos alertas. A planilha original não os trazia escritos; estes são os usuais de
// tráfego pago para captação de leads e podem virar campos da campanha depois.
export const LIMITES = {
  ctrMinimo: 1, // % — abaixo disso, o criativo não está chamando atenção
  connectionMinima: 70, // % — visitas ÷ cliques; abaixo disso, a LP está perdendo gente
  conversaoMinima: 10, // % — leads ÷ visitas
  impressoesMinimas: 1000,
  cliquesMinimos: 30,
  visitasMinimas: 30,
  leadsMinimos: 5,
  folgaDoOrcamento: 1.1, // 10% de tolerância
} as const;

export function resumoDaCampanha(
  c: CampanhaDeDemanda,
  dias: readonly DiaDaCampanha[],
  hoje: string,
): ResumoDaCampanha {
  const funil = funilDeTrafego(dias);
  const periodo = periodoDaCampanha(c, hoje);
  const bruto = periodo ? investimentoBrutoTotal(c, periodo.totais) : null;
  const liquido = bruto === null ? null : investimentoLiquido(bruto, c.tax_pct);
  const restante = liquido === null ? null : liquido - funil.investido;

  const metaDeLeads =
    c.goal_leads ?? (liquido !== null && c.goal_cpl ? Math.floor(liquido / c.goal_cpl) : null);
  const faltam = metaDeLeads === null ? null : Math.max(0, metaDeLeads - funil.leads);
  const metaDeCpl = c.goal_cpl ?? (liquido !== null && metaDeLeads ? liquido / metaDeLeads : null);
  const porDia = metaDeLeads !== null && periodo ? metaDeLeads / periodo.totais : null;
  const metaParaHoje = porDia !== null && periodo ? porDia * periodo.passados : null;

  const metas: MetasDaCampanha = {
    metaDeLeads,
    captados: funil.leads,
    faltam,
    metaDeCpl,
    cplNecessario:
      faltam !== null && faltam > 0 && restante !== null && restante > 0 ? restante / faltam : null,
    porDia,
    metaParaHoje,
    adiantamento: metaParaHoje === null ? null : funil.leads - metaParaHoje,
    novaMetaDiaria:
      faltam !== null && periodo && periodo.restantes > 0 ? faltam / periodo.restantes : null,
  };

  const pace: PaceDeGastos = {
    metaDiaria: liquido !== null && periodo ? liquido / periodo.totais : null,
    mediaAtual: periodo && periodo.passados > 0 ? funil.investido / periodo.passados : null,
    diferenca: null,
    novoOrcamentoDiario:
      restante !== null && periodo && periodo.restantes > 0 && restante > 0
        ? restante / periodo.restantes
        : null,
  };
  if (pace.metaDiaria !== null && pace.mediaAtual !== null) {
    pace.diferenca = pace.metaDiaria - pace.mediaAtual;
  }

  return {
    periodo,
    investimentoBruto: bruto,
    investimentoLiquido: liquido,
    valorRestante: restante,
    metas,
    pace,
    funil,
    alertas: alertasDaCampanha(c, { periodo, restante, metas, pace, funil }),
  };
}

function alertasDaCampanha(
  c: CampanhaDeDemanda,
  r: Pick<ResumoDaCampanha, "periodo" | "metas" | "pace" | "funil"> & { restante: number | null },
): Alerta[] {
  const { periodo, metas, pace, funil, restante } = r;
  const a: Alerta[] = [];
  if (c.channel !== "trafego_pago") return a;
  if (!periodo) {
    a.push({ codigo: "sem_periodo", nivel: "info" });
  }
  if (restante !== null && restante < 0)
    a.push({ codigo: "orcamento_estourado", nivel: "atencao" });
  if (
    funil.impressoes >= LIMITES.impressoesMinimas &&
    funil.ctr !== null &&
    funil.ctr < LIMITES.ctrMinimo
  ) {
    a.push({ codigo: "testar_criativos", nivel: "atencao" });
  }
  if (
    funil.cliques >= LIMITES.cliquesMinimos &&
    funil.connectionRate !== null &&
    funil.connectionRate < LIMITES.connectionMinima
  ) {
    a.push({ codigo: "conexao_da_lp", nivel: "atencao" });
  }
  if (
    funil.visitas >= LIMITES.visitasMinimas &&
    funil.conversaoDaLp !== null &&
    funil.conversaoDaLp < LIMITES.conversaoMinima
  ) {
    a.push({ codigo: "verificar_lp", nivel: "atencao" });
  }
  if (
    funil.leads >= LIMITES.leadsMinimos &&
    funil.cpl !== null &&
    metas.metaDeCpl !== null &&
    funil.cpl > metas.metaDeCpl * LIMITES.folgaDoOrcamento
  ) {
    a.push({ codigo: "cpl_acima_da_meta", nivel: "atencao" });
  }
  if (
    pace.novoOrcamentoDiario !== null &&
    pace.mediaAtual !== null &&
    pace.novoOrcamentoDiario > pace.mediaAtual * LIMITES.folgaDoOrcamento
  ) {
    a.push({ codigo: "aumentar_orcamento", nivel: "atencao", valor: pace.novoOrcamentoDiario });
  }
  if (metas.adiantamento !== null && metas.adiantamento < 0 && (metas.metaParaHoje ?? 0) >= 3) {
    a.push({ codigo: "leads_atrasados", nivel: "atencao", valor: Math.abs(metas.adiantamento) });
  }
  if (a.length === 0 && funil.impressoes > 0) a.push({ codigo: "no_ritmo", nivel: "ok" });
  return a;
}

// ---------------------------------------------------------------------------------------------
// Métricas por canal (os que não têm API: digitadas por dia)
// ---------------------------------------------------------------------------------------------

export interface MetricaDeCanal {
  chave: string;
  /** `moeda` formata em R$; o resto é contagem. */
  tipo: "contagem" | "moeda";
}

/** As colunas dos canais sem API, na ordem do funil de cada um. Os nomes ficam em `rotulos`. */
export const METRICAS_DO_CANAL: Record<
  Exclude<CanalDaCampanha, "trafego_pago">,
  MetricaDeCanal[]
> = {
  prospeccao: [
    { chave: "abordagens", tipo: "contagem" },
    { chave: "contatos", tipo: "contagem" },
    { chave: "decisor", tipo: "contagem" },
    { chave: "reunioes_agendadas", tipo: "contagem" },
    { chave: "reunioes_feitas", tipo: "contagem" },
    { chave: "vendas", tipo: "contagem" },
    { chave: "valor_total", tipo: "moeda" },
  ],
  social_media: [
    { chave: "publicacoes", tipo: "contagem" },
    { chave: "alcance", tipo: "contagem" },
    { chave: "engajamento", tipo: "contagem" },
    { chave: "visitas_ao_perfil", tipo: "contagem" },
    { chave: "cliques_no_link", tipo: "contagem" },
    { chave: "novos_seguidores", tipo: "contagem" },
    { chave: "vendas", tipo: "contagem" },
    { chave: "valor_total", tipo: "moeda" },
  ],
  indicacao: [
    { chave: "indicadores_ativos", tipo: "contagem" },
    { chave: "indicacoes", tipo: "contagem" },
    { chave: "qualificadas", tipo: "contagem" },
    { chave: "reunioes", tipo: "contagem" },
    { chave: "vendas", tipo: "contagem" },
    { chave: "valor_total", tipo: "moeda" },
    { chave: "recompensa_paga", tipo: "moeda" },
  ],
  aproveitamento_de_base: [
    { chave: "clientes_contatados", tipo: "contagem" },
    { chave: "respostas", tipo: "contagem" },
    { chave: "propostas", tipo: "contagem" },
    { chave: "vendas", tipo: "contagem" },
    { chave: "valor_total", tipo: "moeda" },
  ],
  parcerias: [
    { chave: "parceiros_ativos", tipo: "contagem" },
    { chave: "entregas", tipo: "contagem" },
    { chave: "alcance", tipo: "contagem" },
    { chave: "cliques", tipo: "contagem" },
    { chave: "vendas", tipo: "contagem" },
    { chave: "valor_total", tipo: "moeda" },
  ],
};

export function somaDoExtra(dias: readonly DiaDaCampanha[], chave: string): number {
  return dias.reduce((s, d) => s + (d.extras[chave] ?? 0), 0);
}

/** A planilha (CSV) do dia a dia: as colunas do modelo de cada canal. */
export function colunasDoDiaAdia(canal: CanalDaCampanha): string[] {
  if (canal === "trafego_pago") {
    return ["dia", "impressoes", "alcance", "cliques", "visitas_a_lp", "investido"];
  }
  return ["dia", "investido", ...METRICAS_DO_CANAL[canal].map((m) => m.chave)];
}

// ---------------------------------------------------------------------------------------------
// Sincronização com o Meta (C3)
// ---------------------------------------------------------------------------------------------

/**
 * O período a puxar do Meta: do início da campanha (ou 30 dias atrás, se não tem início) até
 * hoje — ou até o fim, se já passou. `null` = a campanha ainda não começou.
 */
export function janelaDaSync(
  c: Pick<CampanhaDeDemanda, "start_date" | "end_date">,
  agora: Date = new Date(),
): { de: string; ate: string } | null {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const hoje = iso(agora);
  const de = c.start_date ?? iso(new Date(agora.getTime() - 30 * MS_DO_DIA));
  const ate = c.end_date && c.end_date < hoje ? c.end_date : hoje;
  return de > ate ? null : { de, ate };
}

// ---------------------------------------------------------------------------------------------
// Leads do CRM (a única fonte de leads das campanhas)
// ---------------------------------------------------------------------------------------------

/**
 * O período em que os leads do CRM contam: do início da campanha (ou 180 dias atrás, sem
 * início) até hoje — ou até o fim, se já passou. `null` = a campanha ainda não começou.
 */
export function janelaDosLeads(
  c: Pick<CampanhaDeDemanda, "start_date" | "end_date">,
  agora: Date = new Date(),
): { de: string; ate: string } | null {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const hoje = iso(agora);
  const de = c.start_date ?? iso(new Date(agora.getTime() - 180 * MS_DO_DIA));
  const ate = c.end_date && c.end_date < hoje ? c.end_date : hoje;
  return de > ate ? null : { de, ate };
}

/**
 * Troca os leads de cada dia pelos do CRM e acrescenta os dias em que só o CRM teve lead. O que
 * estava gravado em `leads` (digitado ou, antes, vindo do Meta) é descartado de propósito.
 */
export function diasComLeadsDoCrm(
  dias: readonly DiaDaCampanha[],
  leadsDoCrm: ReadonlyArray<{ day: string; leads: number }>,
): DiaDaCampanha[] {
  const conta = new Map(leadsDoCrm.map((l) => [l.day, l.leads]));
  const porDia = new Map<string, DiaDaCampanha>();
  for (const d of dias) porDia.set(d.day, { ...d, leads: conta.get(d.day) ?? 0 });
  for (const [day, leads] of conta) {
    if (!porDia.has(day)) {
      porDia.set(day, {
        day,
        impressions: 0,
        reach: 0,
        link_clicks: 0,
        lp_views: 0,
        leads,
        spend: 0,
        extras: {},
        source: "crm",
      });
    }
  }
  return [...porDia.values()].sort((a, b) => a.day.localeCompare(b.day));
}
