import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A abordagem de um disparo tem de ser de WhatsApp e da MESMA campanha de prospecção dona do
 * disparo (a abordagem pertence a uma campanha; usar a de outra misturaria roteiros). Disparo avulso
 * (sem campanha de prospecção) não escolhe abordagem. Devolve a recusa em frase, ou null se vale.
 */
export async function recusaDaAbordagemDoDisparo(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    abordagemId: string | null | undefined;
    demandCampaignId: string | null | undefined;
  },
): Promise<string | null> {
  if (!input.abordagemId) return null;
  if (!input.demandCampaignId) {
    return "Só o disparo de uma campanha de prospecção escolhe abordagem.";
  }
  const { data } = await supabase
    .from("demand_campaign_approaches")
    .select("id, medium")
    .eq("organization_id", input.organizationId)
    .eq("campaign_id", input.demandCampaignId)
    .eq("id", input.abordagemId)
    .maybeSingle();
  if (!data) return "A abordagem não é desta campanha.";
  if ((data as { medium: string }).medium !== "whatsapp") {
    return "O disparo usa abordagem de WhatsApp.";
  }
  return null;
}
