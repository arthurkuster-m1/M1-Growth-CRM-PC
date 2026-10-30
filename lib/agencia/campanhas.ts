import type { CampanhaDeDemanda } from "@/lib/marketing/campanhas";

/**
 * As contas do MODO AGÊNCIA: números puros da lista de campanhas de todos os clientes.
 * Quem lê o banco é a página; aqui só há a régua (prazo, verba total, CPL).
 */

/** De onde vêm os leads de um cliente: do CRM dele, ou só do gerenciador de anúncios (Meta). */
export const ORIGENS_DOS_LEADS = ["crm", "meta"] as const;
export type OrigemDosLeads = (typeof ORIGENS_DOS_LEADS)[number];

export const origemDosLeads = (settings: unknown): OrigemDosLeads => {
  const v = (settings as { leads_source?: unknown } | null)?.leads_source;
  return v === "meta" ? "meta" : "crm";
};

const DIA_MS = 86_400_000;
const emDias = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS);

export interface PrazoDaCampanha {
  /** `continua`, `restam` (dias ≥ 0), `encerrou` (dias > 0 desde o fim) ou `sem_prazo`. */
  tipo: "continua" | "restam" | "encerrou" | "sem_prazo";
  dias: number;
}

/** Quanto tempo falta para acabar a campanha (`hoje` = YYYY-MM-DD no fuso do cliente). */
export function prazoDaCampanha(
  c: Pick<CampanhaDeDemanda, "continuous" | "end_date">,
  hoje: string,
): PrazoDaCampanha {
  if (c.continuous) return { tipo: "continua", dias: 0 };
  if (!c.end_date) return { tipo: "sem_prazo", dias: 0 };
  const d = emDias(hoje, c.end_date);
  return d >= 0 ? { tipo: "restam", dias: d } : { tipo: "encerrou", dias: -d };
}

export interface VerbaDaCampanha {
  /** A verba da campanha inteira; `null` quando não dá para calcular (sem verba ou sem datas). */
  total: number | null;
  /** A verba como foi cadastrada (R$ 50 por dia, por exemplo), para quando o total não existe. */
  periodo: { valor: number; por: "diario" | "semanal" | "mensal" } | null;
}

/** A verba total: cadastrada como total, ou o valor por período vezes a duração da campanha. */
export function verbaDaCampanha(
  c: Pick<CampanhaDeDemanda, "budget" | "budget_period" | "start_date" | "end_date" | "continuous">,
): VerbaDaCampanha {
  const b = c.budget;
  if (b === null || b === undefined || b <= 0) return { total: null, periodo: null };
  if (c.budget_period === "total") return { total: b, periodo: null };
  const periodo = { valor: b, por: c.budget_period } as const;
  if (c.continuous || !c.start_date || !c.end_date) return { total: null, periodo };
  const dias = emDias(c.start_date, c.end_date) + 1;
  if (dias <= 0) return { total: null, periodo };
  const fator =
    c.budget_period === "diario" ? dias : c.budget_period === "semanal" ? dias / 7 : dias / 30.4375;
  return { total: Math.round(b * fator * 100) / 100, periodo };
}

/** O custo por lead; `null` sem lead (dividir por zero não é "zero"). */
export const cplDaCampanha = (investido: number, leads: number): number | null =>
  leads > 0 ? investido / leads : null;
