/**
 * AS METAS QUE SE CALCULAM SOZINHAS. Quem edita um número é a âncora; os que dependem dele se
 * recalculam:
 *
 *   meta de vendas × ticket = meta de faturamento   (e o inverso: faturamento ÷ ticket = vendas)
 *   investimento líquido ÷ meta de leads = meta de CPL   (e o inverso: investimento ÷ CPL = leads)
 *
 * Puro: recebe os valores atuais (já com a edição aplicada) e devolve só o que mudou.
 */
export type CampoQueMudou =
  "goal_leads" | "goal_cpl" | "goal_sales" | "goal_revenue" | "ticket" | "investimento";

export interface EntradaDeMetas {
  goal_leads: number | null;
  goal_cpl: number | null;
  goal_sales: number | null;
  goal_revenue: number | null;
  /** Ticket médio esperado por lead, em reais. */
  ticket: number | null;
  /** Investimento líquido (sem imposto) na mesma base das metas; nulo = não dá para calcular. */
  investimento: number | null;
}

export interface MetasCalculadas {
  goal_leads?: number;
  goal_cpl?: number;
  goal_sales?: number;
  goal_revenue?: number;
}

const centavos = (n: number) => Math.round(n * 100) / 100;
const positivo = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;

export function metasRelacionadas(e: EntradaDeMetas, mudou: CampoQueMudou): MetasCalculadas {
  const r: MetasCalculadas = {};
  switch (mudou) {
    case "goal_sales":
      if (positivo(e.goal_sales) && positivo(e.ticket))
        r.goal_revenue = centavos(e.goal_sales * e.ticket);
      break;
    case "goal_revenue":
      if (positivo(e.goal_revenue) && positivo(e.ticket))
        r.goal_sales = Math.ceil(e.goal_revenue / e.ticket);
      break;
    case "ticket":
      if (positivo(e.ticket)) {
        if (positivo(e.goal_sales)) r.goal_revenue = centavos(e.goal_sales * e.ticket);
        else if (positivo(e.goal_revenue)) r.goal_sales = Math.ceil(e.goal_revenue / e.ticket);
      }
      break;
    case "goal_leads":
      if (positivo(e.goal_leads) && positivo(e.investimento)) {
        r.goal_cpl = centavos(e.investimento / e.goal_leads);
      }
      break;
    case "goal_cpl":
      if (positivo(e.goal_cpl) && positivo(e.investimento)) {
        r.goal_leads = Math.floor(e.investimento / e.goal_cpl);
      }
      break;
    case "investimento":
      if (positivo(e.investimento)) {
        if (positivo(e.goal_leads)) r.goal_cpl = centavos(e.investimento / e.goal_leads);
        else if (positivo(e.goal_cpl)) r.goal_leads = Math.floor(e.investimento / e.goal_cpl);
      }
      break;
  }
  return r;
}

/**
 * O investimento que serve de base para as metas: o líquido, quando o orçamento e as metas valem
 * pelo mesmo período (os dois "total" ou os dois "mensal"). Em qualquer outra combinação não dá
 * para dividir com segurança, e a meta de CPL/leads fica por conta de quem preenche.
 */
export function investimentoBaseDasMetas(
  liquido: number | null,
  periodoDoOrcamento: string,
  periodoDasMetas: string,
): number | null {
  if (liquido === null) return null;
  const mesmoPeriodo =
    (periodoDoOrcamento === "total" && periodoDasMetas === "total") ||
    (periodoDoOrcamento === "mensal" && periodoDasMetas === "mensal");
  return mesmoPeriodo ? liquido : null;
}
