import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Quantos produtos a empresa tem cadastrados (para o cartão "Produtos e ofertas"). */
export async function produtosCadastrados(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("catalog_products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  return count ?? 0;
}
