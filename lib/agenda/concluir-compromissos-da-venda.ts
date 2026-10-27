import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ALVO_DE_VINCULO_DO_AGENDAMENTO } from "@/lib/agenda/tipos";
import { logger } from "@/lib/logger";
import { statusDaOportunidade } from "@/lib/vendas";

const VENDIDAS = new Set([
  "comprometida",
  "concluida",
  "recorrencia_ativa",
  "recorrencia_encerrada",
]);

/**
 * A VENDA PUXA O COMPROMISSO: quando a oportunidade vira venda (comprometida, paga ou recorrente),
 * as reuniões dela que já começaram e seguem abertas passam a "realizado" — quem comprou
 * compareceu. É a volta do caminho "Compareceu e comprou": o resultado do compromisso muda a venda,
 * e a venda mudada pela oportunidade muda o resultado do compromisso.
 *
 * Só toca em compromisso JÁ começado e ainda pendente/confirmado: o que já tem resultado (inclusive
 * "não compareceu") fica como está. Best-effort — falha aqui nunca derruba a venda.
 */
export async function concluirCompromissosDaVenda(
  supabase: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<number> {
  try {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("status, is_recurring, recurrence_active, payments:crm_sale_payments(status)")
      .eq("organization_id", organizationId)
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return 0;
    const l = lead as unknown as {
      status: string | null;
      is_recurring: boolean | null;
      recurrence_active: boolean | null;
      payments: Array<{ status: string }> | null;
    };
    const situacao = statusDaOportunidade(l.status, l.payments ?? [], {
      is_recurring: l.is_recurring,
      recurrence_active: l.recurrence_active,
    });
    if (!VENDIDAS.has(situacao)) return 0;

    const { data: vinculos } = await supabase
      .from("crm_lead_links")
      .select("target_id")
      .eq("organization_id", organizationId)
      .eq("lead_id", leadId)
      .eq("target_kind", ALVO_DE_VINCULO_DO_AGENDAMENTO);
    const ids = ((vinculos ?? []) as Array<{ target_id: string }>).map((v) => v.target_id);
    if (ids.length === 0) return 0;

    const { data: abertos } = await supabase
      .from("calendar_appointments")
      .select("id, revision")
      .eq("organization_id", organizationId)
      .in("id", ids)
      .in("status", ["pending", "confirmed"])
      .lte("starts_at", new Date().toISOString());
    let feitos = 0;
    for (const a of (abertos ?? []) as Array<{ id: string; revision: number | string }>) {
      const { error } = await supabase.rpc("fn_appointment_change", {
        p_org: organizationId,
        p_id: a.id,
        p_revision: Number(a.revision),
        p_patch: { status: "completed" },
      });
      if (!error) feitos += 1;
    }
    return feitos;
  } catch (erro) {
    logger.warn("[agenda] a venda não conseguiu concluir os compromissos dela", {
      leadId,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    return 0;
  }
}
