import type { SupabaseClient } from "@supabase/supabase-js";

/** Os fluxos que esperavam resposta e passaram do prazo terminam sem resposta. */
export async function encerrarFluxosSemResposta(
  admin: SupabaseClient,
  agora: Date,
): Promise<number> {
  const { data } = await admin
    .from("campaign_recipients")
    .update({
      flow_state: "concluido",
      flow_stop_reason: "sem_resposta",
      flow_wait_until: null,
    })
    .eq("flow_state", "aguardando_resposta")
    .not("flow_wait_until", "is", null)
    .lte("flow_wait_until", agora.toISOString())
    .select("id");
  return (data ?? []).length;
}
