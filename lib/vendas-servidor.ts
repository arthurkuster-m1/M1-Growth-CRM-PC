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
 * O RESPONSÁVEL PELA VENDA: o dono do card da venda no funil. `null` tira o responsável. Só
 * aceita alguém ativo da equipe desta empresa. Devolve `false` se não conseguiu gravar.
 */
export async function definirResponsavelDaVenda(
  supabase: SupabaseClient,
  organizationId: string,
  vendaId: string,
  responsavelId: string | null,
): Promise<boolean> {
  const { data: venda } = await supabase
    .from("crm_sales")
    .select("lead_id")
    .eq("id", vendaId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const leadId = (venda as { lead_id: string | null } | null)?.lead_id;
  // Venda sem card ainda: não há onde guardar (o card nasce com a venda; raro).
  if (!leadId) return true;

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
