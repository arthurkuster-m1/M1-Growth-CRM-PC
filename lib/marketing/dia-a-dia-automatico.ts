/**
 * O DIA A DIA AUTOMÁTICO das campanhas que NÃO são de tráfego pago: nada se digita — cada número
 * sai do que o sistema já sabe (vendas pagas, ações registradas, leads do CRM) e o investimento
 * sai do orçamento da campanha, dia a dia. Puro: recebe as linhas já lidas e devolve as contas.
 *
 * Só aparecem as colunas que têm fonte no sistema; as demais ficam de fora (em vez de zero
 * inventado ou de um campo para digitar).
 */
import type { CanalDaCampanha, PeriodoDoOrcamento } from "@/lib/marketing/campanhas";

export interface ContagensDoDia {
  /** Leads que entraram no funil da campanha. */
  leads: number;
  /** Ligações e mensagens registradas na ficha dos leads. */
  abordagens: number;
  reunioesAgendadas: number;
  reunioesFeitas: number;
  propostas: number;
  /** Vendas cuja primeira parcela caiu na conta neste dia. */
  vendas: number;
  /** O dinheiro que entrou neste dia. */
  valorTotal: number;
}

export const CONTAGEM_VAZIA: ContagensDoDia = {
  leads: 0,
  abordagens: 0,
  reunioesAgendadas: 0,
  reunioesFeitas: 0,
  propostas: 0,
  vendas: 0,
  valorTotal: 0,
};

type Mapa = (c: ContagensDoDia) => number;

/** Para cada canal: a chave da métrica → de onde sai. */
const FONTES: Record<Exclude<CanalDaCampanha, "trafego_pago">, Record<string, Mapa>> = {
  prospeccao: {
    abordagens: (c) => c.abordagens,
    contatos: (c) => c.leads,
    reunioes_agendadas: (c) => c.reunioesAgendadas,
    reunioes_feitas: (c) => c.reunioesFeitas,
    vendas: (c) => c.vendas,
    valor_total: (c) => c.valorTotal,
  },
  aproveitamento_de_base: {
    clientes_contatados: (c) => c.abordagens,
    propostas: (c) => c.propostas,
    vendas: (c) => c.vendas,
    valor_total: (c) => c.valorTotal,
  },
  indicacao: {
    indicacoes: (c) => c.leads,
    reunioes: (c) => c.reunioesFeitas,
    vendas: (c) => c.vendas,
    valor_total: (c) => c.valorTotal,
  },
  social_media: { vendas: (c) => c.vendas, valor_total: (c) => c.valorTotal },
  parcerias: { vendas: (c) => c.vendas, valor_total: (c) => c.valorTotal },
};

/** As chaves do canal que o sistema calcula sozinho. */
export function chavesAutomaticas(canal: CanalDaCampanha): string[] {
  if (canal === "trafego_pago") return [];
  return Object.keys(FONTES[canal]);
}

/** O que cada dia ganha, para as colunas automáticas do canal. */
export function extrasDoDia(canal: CanalDaCampanha, c: ContagensDoDia): Record<string, number> {
  if (canal === "trafego_pago") return {};
  const saida: Record<string, number> = {};
  for (const [chave, de] of Object.entries(FONTES[canal])) saida[chave] = de(c);
  return saida;
}

/** O investimento de UM dia, pelo orçamento da campanha; `null` quando não dá para saber. */
export function investimentoDoDia(
  c: {
    budget: number | null;
    budget_period: PeriodoDoOrcamento;
    start_date: string | null;
    end_date: string | null;
  },
  dia: string,
  hoje: string,
): number | null {
  if (c.budget === null || !c.start_date) return null;
  if (dia < c.start_date || dia > hoje) return null;
  if (c.end_date && dia > c.end_date) return null;
  switch (c.budget_period) {
    case "diario":
      return c.budget;
    case "semanal":
      return Math.round((c.budget / 7) * 100) / 100;
    case "mensal":
      return Math.round((c.budget / 30) * 100) / 100;
    case "total": {
      if (!c.end_date) return null;
      const d = (a: string) => Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) / 86_400_000;
      const dias = Math.max(1, d(c.end_date) - d(c.start_date) + 1);
      return Math.round((c.budget / dias) * 100) / 100;
    }
  }
}

/** O dia (AAAA-MM-DD) de um instante, no fuso da organização. */
export function diaNoFuso(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date(iso));
}
