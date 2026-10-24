import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EntradaDoFluxo } from "@/lib/agenda/anti-no-show";

/**
 * Liga os tipos ao fluxo: cada tipo tem no máximo um fluxo, então um tipo escolhido aqui sai do
 * fluxo em que estava. Só aceita tipos da empresa. Devolve false se algo falhou.
 */
export async function ligarTiposAoFluxo(
  supabase: SupabaseClient,
  orgId: string,
  flowId: string,
  tipos: EntradaDoFluxo["event_type_ids"],
): Promise<boolean> {
  const unicos = [...new Set(tipos)];
  const { data: validos } = unicos.length
    ? await supabase
        .from("calendar_event_types")
        .select("id")
        .eq("organization_id", orgId)
        .in("id", unicos)
    : { data: [] };
  const aceitos = ((validos ?? []) as Array<{ id: string }>).map((t) => t.id);
  if (aceitos.length > 0) {
    const { error } = await supabase
      .from("agenda_noshow_flow_types")
      .delete()
      .eq("organization_id", orgId)
      .in("event_type_id", aceitos)
      .neq("flow_id", flowId);
    if (error) return false;
  }
  const { error: erroTira } = await supabase
    .from("agenda_noshow_flow_types")
    .delete()
    .eq("organization_id", orgId)
    .eq("flow_id", flowId)
    .not(
      "event_type_id",
      "in",
      `(${aceitos.length > 0 ? aceitos.join(",") : "00000000-0000-0000-0000-000000000000"})`,
    );
  if (erroTira) return false;
  if (aceitos.length === 0) return true;
  const { error } = await supabase.from("agenda_noshow_flow_types").upsert(
    aceitos.map((event_type_id) => ({
      organization_id: orgId,
      flow_id: flowId,
      event_type_id,
    })),
    { onConflict: "event_type_id" },
  );
  return !error;
}
