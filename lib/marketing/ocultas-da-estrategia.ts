import "server-only";

import { OcultosDaEstrategia } from "@/lib/marketing/estrategia-oculta";
import { createClient } from "@/lib/supabase/server";

/**
 * O que a agência ocultou da aba Estratégia desta empresa. Se a tabela ainda não existe (migration
 * 0691 não aplicada) ou a leitura falha, nada fica oculto: a aba aparece completa, como sempre foi.
 */
export async function ocultasDaEstrategia(orgId: string): Promise<OcultosDaEstrategia> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("marketing_estrategia_ocultos")
      .select("chave")
      .eq("organization_id", orgId)
      .limit(200);
    if (error) return new OcultosDaEstrategia(new Set());
    return new OcultosDaEstrategia(
      new Set(((data ?? []) as Array<{ chave: string }>).map((l) => l.chave)),
    );
  } catch {
    return new OcultosDaEstrategia(new Set());
  }
}
