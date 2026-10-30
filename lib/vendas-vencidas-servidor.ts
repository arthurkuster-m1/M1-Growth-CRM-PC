import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { textoDoAvisoDeVencidas, vencidoPorEmpresa, type ParcelaVencida } from "@/lib/vendas-vencidas";

/** Marca o aviso desta rotina na Central: um por empresa (`ref_kind` + `ref_id` = a empresa). */
const REF = "parcelas_vencidas";

/**
 * Abre, atualiza e resolve o aviso "Parcelas vencidas" de cada empresa na Central. Idempotente: roda
 * todo dia e deixa UM aviso aberto por empresa com parcela vencida (o texto sempre com o número de
 * hoje); quando não sobra vencida, o aviso aberto é resolvido. `hoje` = YYYY-MM-DD no fuso da operação.
 * Vendas perdidas e empresas que não operam não contam. Filtra `organization_id` em toda escrita.
 */
export async function avisarParcelasVencidas(
  admin: SupabaseClient,
  hoje: string,
): Promise<{ abertos: number; atualizados: number; resolvidos: number }> {
  const parcelas: ParcelaVencida[] = [];
  const { data } = await admin
    .from("crm_sale_payments")
    .select("organization_id, lead_id, amount_cents, crm_leads!inner(status)")
    .eq("status", "prevista")
    .lt("due_on", hoje)
    .neq("crm_leads.status", "lost")
    .limit(50000);
  for (const p of (data ?? []) as Array<{ organization_id: string; lead_id: string; amount_cents: number | string }>) {
    parcelas.push({ organization_id: p.organization_id, lead_id: p.lead_id, amount_cents: Number(p.amount_cents) || 0 });
  }
  // Só empresas que operam: organização parada/suspensa não recebe aviso novo.
  const { data: ativas } = await admin.from("organizations").select("id").eq("status", "active").limit(5000);
  const operantes = new Set(((ativas ?? []) as Array<{ id: string }>).map((o) => o.id));
  const vencidos = vencidoPorEmpresa(parcelas.filter((p) => operantes.has(p.organization_id)));

  const { data: abertos } = await admin
    .from("agent_inbox_items")
    .select("id, organization_id")
    .eq("ref_kind", REF)
    .eq("status", "open");
  const abertoDa = new Map(((abertos ?? []) as Array<{ id: string; organization_id: string }>).map((a) => [a.organization_id, a.id]));

  let novos = 0;
  let atualizados = 0;
  for (const v of vencidos) {
    const { titulo, corpo } = textoDoAvisoDeVencidas(v);
    const existente = abertoDa.get(v.organization_id);
    if (existente) {
      await admin.from("agent_inbox_items").update({ title: titulo, body: corpo }).eq("id", existente).eq("organization_id", v.organization_id);
      atualizados += 1;
    } else {
      await admin.from("agent_inbox_items").insert({
        organization_id: v.organization_id,
        kind: "other",
        severity: "warn",
        title: titulo,
        body: corpo,
        ref_kind: REF,
        ref_id: v.organization_id,
        status: "open",
      });
      novos += 1;
    }
  }
  const comVencido = new Set(vencidos.map((v) => v.organization_id));
  let resolvidos = 0;
  for (const [org, id] of abertoDa) {
    if (comVencido.has(org)) continue;
    await admin
      .from("agent_inbox_items")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", org);
    resolvidos += 1;
  }
  return { abertos: novos, atualizados, resolvidos };
}
