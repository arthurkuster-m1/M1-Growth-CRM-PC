import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ParcelaDaVenda, VendaFechada } from "@/lib/dashboards/fechamento";

const diaNoFuso = (iso: string | null | undefined, fuso: string): string | null =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date(iso)) : null;

/**
 * As vendas FECHADAS no período (cards em Comprou, pela data de fechamento) e as parcelas delas — de
 * sempre, não só do período. Filtra `organization_id` em toda consulta. `leadIds` restringe às vendas
 * de um conjunto de oportunidades (as das campanhas escolhidas).
 */
export async function lerFechamento(
  supabase: SupabaseClient,
  orgId: string,
  de: string,
  ate: string,
  fuso: string,
  leadIds?: readonly string[],
): Promise<{ vendas: VendaFechada[]; parcelas: ParcelaDaVenda[] }> {
  type Linha = {
    id: string;
    value_cents: number | string | null;
    closed_at: string | null;
    paid_on: string | null;
  };
  const brutas: Linha[] = [];
  const colunas = "id, value_cents, closed_at, paid_on";
  if (leadIds) {
    for (let i = 0; i < leadIds.length; i += 200) {
      const { data } = await supabase
        .from("crm_leads")
        .select(colunas)
        .eq("organization_id", orgId)
        .eq("status", "won")
        .in("id", leadIds.slice(i, i + 200));
      brutas.push(...((data ?? []) as Linha[]));
    }
  } else {
    const { data } = await supabase
      .from("crm_leads")
      .select(colunas)
      .eq("organization_id", orgId)
      .eq("status", "won")
      .gte("closed_at", new Date(Date.parse(`${de}T00:00:00Z`) - 86_400_000).toISOString())
      .lte("closed_at", new Date(Date.parse(`${ate}T00:00:00Z`) + 2 * 86_400_000).toISOString())
      .limit(20000);
    brutas.push(...((data ?? []) as Linha[]));
  }
  const vendas: VendaFechada[] = brutas
    .filter((l) => {
      const dia = diaNoFuso(l.closed_at, fuso) ?? l.paid_on;
      return dia !== null && dia >= de && dia <= ate;
    })
    .map((l) => ({ id: l.id, valor_cents: Number(l.value_cents) || 0 }));

  const parcelas: ParcelaDaVenda[] = [];
  const ids = vendas.map((v) => v.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("crm_sale_payments")
      .select("lead_id, status, amount_cents, due_on")
      .eq("organization_id", orgId)
      .in("lead_id", ids.slice(i, i + 200));
    for (const p of (data ?? []) as Array<{
      lead_id: string;
      status: ParcelaDaVenda["status"];
      amount_cents: number | string;
      due_on: string;
    }>) {
      parcelas.push({
        lead_id: p.lead_id,
        status: p.status,
        amount_cents: Number(p.amount_cents) || 0,
        due_on: String(p.due_on).slice(0, 10),
      });
    }
  }
  return { vendas, parcelas };
}
