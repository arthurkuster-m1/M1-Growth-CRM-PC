/**
 * O FECHAMENTO DO PERÍODO — a visão "por data de fechamento": das vendas FECHADAS no período (o card foi
 * para Comprou), quanto vale o fechado, quanto já voltou em dinheiro (até hoje), quanto ainda falta
 * receber e quanto desse falta está VENCIDO. É a régua justa para avaliar uma campanha: o faturamento
 * recebido do mês mistura parcelas de vendas antigas; este número segue as vendas que a campanha gerou.
 * Contas puras; quem lê o banco são as rotas de dashboard.
 */
export interface VendaFechada {
  id: string;
  /** O valor total da venda, em centavos. */
  valor_cents: number;
  /** A campanha dona (opcional): agrupa o resultado. */
  campanha_id?: string | null;
}

export interface ParcelaDaVenda {
  lead_id: string;
  status: "recebida" | "prevista" | "cancelada";
  amount_cents: number;
  /** Vencimento (YYYY-MM-DD) — para saber se a parcela prevista já venceu. */
  due_on: string;
}

export interface ResumoDeFechamento {
  vendas: number;
  fechado: number;
  recebido: number;
  aReceber: number;
  vencido: number;
  vendasComVencido: number;
  /** Quanto do fechado já voltou, em %, ou `null` sem fechado. */
  percentualRecebido: number | null;
  /** Ticket médio do FECHADO (fechado ÷ vendas), ou `null` sem venda. */
  ticketMedio: number | null;
}

const reais = (cents: number) => Math.round(cents) / 100;

export function resumoDeFechamento(
  vendas: readonly VendaFechada[],
  parcelas: readonly ParcelaDaVenda[],
  hoje: string,
): ResumoDeFechamento {
  const ids = new Set(vendas.map((v) => v.id));
  let recebido = 0;
  let aReceber = 0;
  let vencido = 0;
  const comVencido = new Set<string>();
  for (const p of parcelas) {
    if (!ids.has(p.lead_id)) continue;
    if (p.status === "recebida") recebido += p.amount_cents;
    else if (p.status === "prevista") {
      aReceber += p.amount_cents;
      if (p.due_on < hoje) {
        vencido += p.amount_cents;
        comVencido.add(p.lead_id);
      }
    }
  }
  const fechadoCents = vendas.reduce((s, v) => s + v.valor_cents, 0);
  return {
    vendas: vendas.length,
    fechado: reais(fechadoCents),
    recebido: reais(recebido),
    aReceber: reais(aReceber),
    vencido: reais(vencido),
    vendasComVencido: comVencido.size,
    percentualRecebido: fechadoCents > 0 ? Math.round((recebido / fechadoCents) * 1000) / 10 : null,
    ticketMedio: vendas.length > 0 ? reais(fechadoCents / vendas.length) : null,
  };
}
