import "server-only";

import { marcaDaInstalacao } from "@/lib/branding/instalacao";
import { resolverMarcaDaOrganizacao } from "@/lib/branding/organizacao";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** O nome e a cor da marca da empresa (para o cartão-resumo). A cor cai no verde da M1. */
export async function marcaDaOrg(orgId: string): Promise<{ nome: string; cor: string }> {
  const padrao = { nome: "", cor: "#366D6F" };
  try {
    const { data } = await createAdminClient()
      .from("organizations")
      .select("display_name, settings")
      .eq("id", orgId)
      .maybeSingle();
    const org = data as { display_name?: string; settings?: unknown } | null;
    const marca = resolverMarcaDaOrganizacao(
      (org?.settings as Record<string, unknown> | null) ?? null,
      await marcaDaInstalacao(),
      env,
    );
    const bruta: string | null = marca.cor?.semente ?? null;
    const cor = bruta && /^#[0-9a-fA-F]{6}$/.test(bruta) ? bruta : padrao.cor;
    return { nome: org?.display_name?.trim() || marca.name, cor };
  } catch {
    return padrao;
  }
}
