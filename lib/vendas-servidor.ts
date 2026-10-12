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
