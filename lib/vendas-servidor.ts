import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Toda venda é de um PRODUTO CADASTRADO (Produtos e Ofertas). Confere que cada item aponta para
 * um produto desta empresa e completa o nome (o nome da venda é o do cadastro, mesmo que o valor
 * tenha mudado por desconto).
 */
export async function completarItensComProduto<
  T extends { product_id: string; product_name?: string | undefined },
>(
  supabase: SupabaseClient,
  organizationId: string,
  itens: readonly T[],
): Promise<{ ok: true; itens: Array<T & { product_name: string }> } | { ok: false }> {
  const ids = [...new Set(itens.map((i) => i.product_id))];
  if (ids.length === 0) return { ok: true, itens: [] };
  const { data } = await supabase
    .from("marketing_pages")
    .select("id, title, module_key")
    .eq("organization_id", organizationId)
    .like("module_key", "produtos-e-ofertas--%")
    .in("id", ids);
  const nomes = new Map(
    (data ?? []).map((p) => [p.id as string, (p.title as string) || "Produto"]),
  );
  if (ids.some((id) => !nomes.has(id))) return { ok: false };
  return {
    ok: true,
    itens: itens.map((i) => ({
      ...i,
      product_name: (nomes.get(i.product_id) ?? "Produto").slice(0, 200),
    })),
  };
}

/**
 * O RESPONSÁVEL PELA OPORTUNIDADE (o dono do card no funil). `null` tira o responsável. Só aceita
 * alguém ativo da equipe desta empresa. Devolve `false` se não conseguiu gravar.
 */
export async function definirResponsavelDaVenda(
  supabase: SupabaseClient,
  organizationId: string,
  leadId: string,
  responsavelId: string | null,
): Promise<boolean> {
  if (responsavelId) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { isServiceRoleConfigured } = await import("@/lib/audit");
    if (isServiceRoleConfigured()) {
      const { data: membro } = await createAdminClient()
        .from("user_organizations")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("user_id", responsavelId)
        .is("revoked_at", null)
        .maybeSingle();
      if (!membro) return false;
    }
  }
  const { error } = await supabase
    .from("crm_leads")
    .update(
      responsavelId
        ? {
            owner_user_id: responsavelId,
            owner_agent_id: null,
            owner_kind: "user",
            assigned_at: new Date().toISOString(),
          }
        : { owner_user_id: null, owner_agent_id: null, owner_kind: null },
    )
    .eq("id", leadId)
    .eq("organization_id", organizationId);
  return !error;
}

interface ItemParaGravar {
  product_id: string;
  product_name: string;
  quantity: number;
  amount_cents: number;
}
interface ParcelaParaGravar {
  number: number;
  due_on: string;
  paid_on?: string | null;
  amount_cents: number;
  status: "prevista" | "recebida" | "cancelada";
}

/**
 * Grava os produtos e as parcelas de uma OPORTUNIDADE. Os itens substituem os anteriores; as
 * parcelas são atualizadas pelo número (e só se cria/apaga o que mudou), assim forma, origem, id
 * externo, quem confirmou e os avisos de cada parcela não se perdem. Parcela cancelada fica.
 * Devolve `false` se algum passo falhou.
 */
export async function gravarItensEParcelas(
  supabase: SupabaseClient,
  organizationId: string,
  leadId: string,
  itens: readonly ItemParaGravar[] | undefined,
  pagamentos: readonly ParcelaParaGravar[] | undefined,
): Promise<boolean> {
  if (itens !== undefined) {
    await supabase
      .from("crm_sale_items")
      .delete()
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId);
    if (itens.length > 0) {
      const { error } = await supabase.from("crm_sale_items").insert(
        itens.map((i, k) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          amount_cents: i.amount_cents,
          organization_id: organizationId,
          lead_id: leadId,
          position: k,
        })),
      );
      if (error) return false;
    }
  }
  if (pagamentos !== undefined) {
    const { data: existentes } = await supabase
      .from("crm_sale_payments")
      .select("id, number, status")
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId);
    const vivas = ((existentes ?? []) as Array<{ id: string; number: number; status: string }>)
      .filter((p) => p.status !== "cancelada")
      .sort((a, b) => a.number - b.number);
    const usadas = new Set<string>();
    const novas: ParcelaParaGravar[] = [];
    for (const p of pagamentos) {
      const alvo = vivas.find((e) => e.number === p.number && !usadas.has(e.id));
      if (!alvo) {
        novas.push(p);
        continue;
      }
      usadas.add(alvo.id);
      const { error } = await supabase
        .from("crm_sale_payments")
        .update({
          due_on: p.due_on,
          paid_on: p.paid_on ?? null,
          amount_cents: p.amount_cents,
          status: p.status,
        })
        .eq("id", alvo.id)
        .eq("organization_id", organizationId);
      if (error) return false;
    }
    const sobrando = vivas.filter((e) => !usadas.has(e.id)).map((e) => e.id);
    if (sobrando.length > 0) {
      await supabase
        .from("crm_sale_payments")
        .delete()
        .in("id", sobrando)
        .eq("organization_id", organizationId);
    }
    if (novas.length > 0) {
      const { error } = await supabase.from("crm_sale_payments").insert(
        novas.map((p) => ({
          number: p.number,
          due_on: p.due_on,
          paid_on: p.paid_on ?? null,
          amount_cents: p.amount_cents,
          status: p.status,
          organization_id: organizationId,
          lead_id: leadId,
        })),
      );
      if (error) return false;
    }
  }
  return true;
}

/**
 * Onde nasce uma oportunidade nova de um contato: o funil do cadastro mais recente dele (ou o
 * funil padrão da empresa) e a primeira etapa aberta desse funil.
 */
export async function destinoDeUmaOportunidadeNova(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string,
  pipelineId?: string | null,
): Promise<{ pipeline_id: string; stage_id: string } | null> {
  let funil = pipelineId ?? null;
  if (!funil) {
    const { data: ultimo } = await supabase
      .from("crm_leads")
      .select("pipeline_id")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    funil = (ultimo as { pipeline_id: string } | null)?.pipeline_id ?? null;
  }
  if (!funil) {
    const { data: padrao } = await supabase
      .from("crm_pipelines")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_archived", false)
      .order("is_default", { ascending: false })
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    funil = (padrao as { id: string } | null)?.id ?? null;
  }
  if (!funil) return null;
  const { data: etapa } = await supabase
    .from("crm_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("pipeline_id", funil)
    .eq("is_won", false)
    .eq("is_lost", false)
    .is("qualification", null)
    .eq("is_archived", false)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  const stageId = (etapa as { id: string } | null)?.id;
  return stageId ? { pipeline_id: funil, stage_id: stageId } : null;
}

/**
 * Os campos da venda que moram na oportunidade (`crm_leads`). O que é derivado (status, datas de
 * pagamento) não se grava: vem das parcelas e da etapa.
 */
export function camposDaOportunidade(c: {
  name?: string;
  description?: string;
  currency?: string;
  expected_close_date?: string | null;
  is_recurring?: boolean;
  recurrence_active?: boolean;
  recurrence_ahead?: number;
  payment_method?: string;
  installments?: number;
  reference?: string;
  notes?: string;
  demand_campaign_id?: string | null;
}): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (c.name !== undefined) o.nome_da_venda = c.name;
  if (c.description !== undefined) o.description = c.description === "" ? null : c.description;
  if (c.currency !== undefined) o.currency = c.currency;
  if (c.expected_close_date !== undefined) o.expected_close_date = c.expected_close_date;
  if (c.is_recurring !== undefined) o.is_recurring = c.is_recurring;
  if (c.recurrence_active !== undefined) o.recurrence_active = c.recurrence_active;
  if (c.recurrence_ahead !== undefined) o.recurrence_ahead = c.recurrence_ahead;
  if (c.payment_method !== undefined) o.payment_method = c.payment_method;
  if (c.installments !== undefined) o.installments = c.installments;
  if (c.reference !== undefined) o.reference = c.reference;
  if (c.notes !== undefined) o.notes = c.notes;
  if (c.demand_campaign_id !== undefined) o.demand_campaign_id = c.demand_campaign_id;
  return o;
}
