import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { chaveDoDia } from "@/lib/inicio/datas";
import { FUSO_DO_CRONOGRAMA, type MetaDoCronograma } from "@/lib/marketing/cronograma";
import { diasDecorridos, janelaDoPeriodo, type Periodo } from "@/lib/marketing/periodos";

/**
 * AS METAS AUTOMÁTICAS do cronograma: o "onde estamos hoje" lido dos números reais do CRM em vez
 * de digitado. Cada meta diz a fonte (leads, vendas, faturamento recebido, a receber,
 * investimento, CPL ou ROAS), o período (hoje, últimos 5 dias, este mês…) e se é a soma ou a média
 * por dia — "30 leads/dia" é leads, últimos 5 dias, média diária.
 *
 * Nunca lança: se a leitura falhar, a meta fica com o valor que já tinha.
 */
export async function aplicarMetasAutomaticas<T extends MetaDoCronograma>(
  db: SupabaseClient,
  organizationId: string,
  metas: readonly T[],
  agora: Date = new Date(),
): Promise<T[]> {
  const automaticas = metas.filter((m) => m.fonte !== "manual");
  if (automaticas.length === 0) return [...metas];
  const hoje = chaveDoDia(agora, FUSO_DO_CRONOGRAMA);

  const porPeriodo = new Map<Periodo, Awaited<ReturnType<typeof ler>>>();
  async function ler(periodo: Periodo) {
    const j = janelaDoPeriodo(periodo, hoje);
    const { data } = await db.rpc("fn_metricas_do_crm", {
      p_org: organizationId,
      p_from: j.de,
      p_to: j.ate,
      p_tz: FUSO_DO_CRONOGRAMA,
    });
    const linha = (Array.isArray(data) ? data[0] : data) as
      | {
          leads: number;
          vendas: number;
          recebido: number | string;
          a_receber: number | string;
          investido: number | string;
        }
      | undefined;
    return {
      janela: j,
      leads: Number(linha?.leads) || 0,
      vendas: Number(linha?.vendas) || 0,
      recebido: (Number(linha?.recebido) || 0) / 100,
      aReceber: (Number(linha?.a_receber) || 0) / 100,
      investido: Number(linha?.investido) || 0,
    };
  }

  try {
    for (const p of new Set(automaticas.map((m) => m.periodo))) {
      porPeriodo.set(p, await ler(p));
    }
  } catch {
    return [...metas];
  }

  return metas.map((m) => {
    if (m.fonte === "manual") return m;
    const n = porPeriodo.get(m.periodo);
    if (!n) return m;
    let valor: number | null;
    switch (m.fonte) {
      case "leads":
        valor = n.leads;
        break;
      case "vendas":
        valor = n.vendas;
        break;
      case "faturamento":
        valor = n.recebido;
        break;
      case "a_receber":
        valor = n.aReceber;
        break;
      case "investido":
        valor = n.investido;
        break;
      case "cpl":
        valor = n.leads > 0 ? n.investido / n.leads : null;
        break;
      case "roas":
        valor = n.investido > 0 ? n.recebido / n.investido : null;
        break;
    }
    if (valor !== null && m.calculo === "media_diaria" && !["cpl", "roas"].includes(m.fonte)) {
      valor = valor / diasDecorridos(n.janela, hoje);
    }
    return { ...m, valor_atual: valor === null ? null : Math.round(valor * 100) / 100 };
  });
}
