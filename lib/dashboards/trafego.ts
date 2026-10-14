import { somarDias } from "@/lib/inicio/datas";

/**
 * AS CONTAS DO DASHBOARD DE TRÁFEGO PAGO — puras (sem banco), para a rota só buscar e esta
 * montar. Regras (as mesmas do resto do sistema):
 *  - leads = pessoas do CRM por dia;
 *  - venda = venda com algo pago, contada no dia da PRIMEIRA parcela recebida;
 *  - faturamento = parcelas recebidas, no dia em que caíram.
 */

export interface DiaDeTrafego {
  data: string;
  impressoes: number;
  alcance: number;
  cliques: number;
  viewsLP: number;
  leads: number;
  investimento: number;
  vendas: number;
  recebido: number;
}

export interface LinhaDoMeta {
  campaign_id: string;
  day: string;
  impressions: number;
  reach: number;
  link_clicks: number;
  lp_views: number;
  spend: number;
}

export interface PagamentoRecebido {
  sale_id: string;
  campaign_id: string | null;
  paid_on: string;
  amount: number; // em reais
}

export function diasEntre(de: string, ate: string, limite = 400): string[] {
  const dias: string[] = [];
  for (let d = de; d <= ate && dias.length < limite; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

/** O período anterior, do mesmo tamanho, terminando na véspera do início. */
export function periodoAnterior(de: string, ate: string): { de: string; ate: string } {
  const n = diasEntre(de, ate).length;
  return { de: somarDias(de, -n), ate: somarDias(de, -1) };
}

/** Dia a dia consolidado (todas as campanhas escolhidas) dentro de [de, ate]. */
export function montarDias(
  de: string,
  ate: string,
  meta: readonly LinhaDoMeta[],
  leadsPorDia: ReadonlyMap<string, number>,
  pagamentos: readonly PagamentoRecebido[],
): DiaDeTrafego[] {
  const mapa = new Map<string, DiaDeTrafego>(
    diasEntre(de, ate).map((data) => [
      data,
      {
        data,
        impressoes: 0,
        alcance: 0,
        cliques: 0,
        viewsLP: 0,
        leads: leadsPorDia.get(data) ?? 0,
        investimento: 0,
        vendas: 0,
        recebido: 0,
      },
    ]),
  );
  for (const l of meta) {
    const d = mapa.get(l.day);
    if (!d) continue;
    d.impressoes += l.impressions;
    d.alcance += l.reach;
    d.cliques += l.link_clicks;
    d.viewsLP += l.lp_views;
    d.investimento += l.spend;
  }
  const primeira = new Map<string, string>();
  for (const p of pagamentos) {
    const d = mapa.get(p.paid_on);
    if (d) d.recebido += p.amount;
    const atual = primeira.get(p.sale_id);
    if (!atual || p.paid_on < atual) primeira.set(p.sale_id, p.paid_on);
  }
  for (const dia of primeira.values()) {
    const d = mapa.get(dia);
    if (d) d.vendas += 1;
  }
  return [...mapa.values()].map((d) => ({
    ...d,
    investimento: Math.round(d.investimento * 100) / 100,
    recebido: Math.round(d.recebido * 100) / 100,
  }));
}

export function somarDias_(dias: readonly DiaDeTrafego[]): Omit<DiaDeTrafego, "data"> {
  const z = { impressoes: 0, alcance: 0, cliques: 0, viewsLP: 0, leads: 0, investimento: 0, vendas: 0, recebido: 0 };
  for (const d of dias) {
    z.impressoes += d.impressoes;
    z.alcance += d.alcance;
    z.cliques += d.cliques;
    z.viewsLP += d.viewsLP;
    z.leads += d.leads;
    z.investimento += d.investimento;
    z.vendas += d.vendas;
    z.recebido += d.recebido;
  }
  return z;
}
