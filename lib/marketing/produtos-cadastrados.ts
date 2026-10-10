import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Quantas ofertas publicadas a empresa tem (as que viram produto e preço para a IA). */
export async function produtosCadastrados(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("catalog_products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("origem", "oferta")
    .eq("ativo", true);
  return count ?? 0;
}
