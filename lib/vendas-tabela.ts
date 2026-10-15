/**
 * A TABELA DE VENDAS (ficha do cliente e visão Vendas do CRM): o que cada linha mostra, calculado
 * das PARCELAS da oportunidade. Uma conta só, para as duas telas não divergirem.
 */
import type { ParcelaDaVenda, Venda } from "@/lib/vendas";
import { nomeDaVenda } from "@/lib/vendas";

const dia = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : null);

export interface ResumoDaVenda {
  /** Parcelas que contam (as canceladas ficam de fora). */
  parcelas: ParcelaDaVenda[];
  parcelasPagas: number;
  pagoCents: number;
  previstoCents: number;
  totalCents: number;
  primeiroPagamento: string | null;
  ultimoPagamento: string | null;
  /** Vencimento da próxima parcela prevista; `null` quando está 100% paga (ou sem parcelas). */
  proximoPagamento: string | null;
  produtos: string;
}

export function resumoDaVenda(v: Venda): ResumoDaVenda {
  const parcelas = (v.parcelas ?? []).filter((p) => p.status !== "cancelada");
  const recebidas = parcelas.filter((p) => p.status === "recebida");
  const previstas = parcelas.filter((p) => p.status === "prevista");
  const datasPagas = recebidas
    .map((p) => dia(p.paid_on))
    .filter((d): d is string => d !== null)
    .sort();
  const vencimentos = previstas
    .map((p) => dia(p.due_on))
    .filter((d): d is string => d !== null)
    .sort();
  const produtos = (v.itens ?? [])
    .map((i) => i.product_name)
    .filter(Boolean)
    .join(" + ");
  return {
    parcelas,
    parcelasPagas: recebidas.length,
    pagoCents: recebidas.reduce((s, p) => s + p.amount_cents, 0),
    previstoCents: previstas.reduce((s, p) => s + p.amount_cents, 0),
    totalCents: v.amount_cents,
    primeiroPagamento: datasPagas[0] ?? null,
    ultimoPagamento: datasPagas[datasPagas.length - 1] ?? null,
    proximoPagamento: vencimentos[0] ?? null,
    produtos: produtos || v.product_name || nomeDaVenda(v),
  };
}

/**
 * O recorte de UM mês ("Recebido no mês"): a venda continua na lista, mas só com as parcelas e os
 * valores PAGOS naquele mês. Uma venda de janeiro em 5 parcelas, vista em maio, mostra só a
 * parcela e o valor de maio. `mes` = `AAAA-MM`.
 */
export function recorteDoMes(v: Venda, mes: string): Venda {
  const doMes = (v.parcelas ?? []).filter(
    (p) => p.status === "recebida" && (dia(p.paid_on) ?? "").slice(0, 7) === mes,
  );
  const total = doMes.reduce((s, p) => s + p.amount_cents, 0);
  return { ...v, parcelas: doMes, amount_cents: total };
}

/** Recebeu alguma parcela no mês? (o filtro "Recebido no mês" usa isto). */
export function recebeuNoMes(v: Venda, mes: string): boolean {
  return (v.parcelas ?? []).some(
    (p) => p.status === "recebida" && (dia(p.paid_on) ?? "").slice(0, 7) === mes,
  );
}
