import type { SupabaseClient } from "@supabase/supabase-js";

import { googleTransport } from "@/lib/agenda/google/transport";
import { reconcileAppointment, tokenForConnection } from "@/lib/agenda/google/sync-executor";

export type DestinoNoGoogle = "movido" | "so_no_app" | "sem_evento" | "remocao_pendente";

/** O que limpar do compromisso para ele deixar de apontar para o evento da agenda do responsável anterior. */
export const CAMPOS_DO_EVENTO_ANTIGO = {
  google_event_id: null,
  google_connection_id: null,
  google_calendar_id: null,
  google_etag: null,
  google_ical_uid: null,
  google_synced_at: null,
  google_sync_error: null,
  google_base_projection: null,
  google_pending_write: null,
  google_conflict: null,
  google_claim_token: null,
  google_claim_until: null,
} as const;

/**
 * Passa o evento do Google do responsável anterior para o novo: apaga da agenda dele e cria na do
 * novo. Sem Google conectado no novo responsável, o compromisso fica só na agenda do app.
 *
 * Quem chama já validou permissão, equipe e choque de horário.
 */
export async function moverEventoParaOutroResponsavel(
  admin: SupabaseClient,
  org: string,
  a: {
    id: string;
    google_event_id: string | null;
    google_connection_id: string | null;
    google_calendar_id: string | null;
  },
  novoResponsavelId: string,
): Promise<DestinoNoGoogle> {
  let removido = true;
  if (a.google_event_id && a.google_connection_id && a.google_calendar_id) {
    try {
      const token = await tokenForConnection(admin, org, a.google_connection_id);
      const g = googleTransport(token);
      const remoto = await g.get(a.google_calendar_id, a.google_event_id);
      if (remoto) await g.write(a.google_calendar_id, a.google_event_id, "DELETE", undefined, remoto.etag ?? null);
    } catch {
      removido = false;
    }
  }

  const tinhaEvento = Boolean(a.google_event_id);
  const { error } = await admin
    .from("calendar_appointments")
    .update({
      owner_user_id: novoResponsavelId,
      ...(tinhaEvento ? CAMPOS_DO_EVENTO_ANTIGO : {}),
    })
    .eq("organization_id", org)
    .eq("id", a.id);
  if (error) throw new Error(error.message);

  const { data: conexao } = await admin
    .from("calendar_connections")
    .select("id")
    .eq("organization_id", org)
    .eq("user_id", novoResponsavelId)
    .eq("status", "healthy")
    .eq("provider", "google_calendar")
    .limit(1);
  if (!conexao?.length) return "so_no_app";
  // Marca como "ainda não foi ao Google": se a criação agora falhar, a rotina de ida tenta de novo.
  if (tinhaEvento)
    await admin
      .from("calendar_appointments")
      .update({ google_synced_local_revision: 0 })
      .eq("organization_id", org)
      .eq("id", a.id);
  try {
    await reconcileAppointment(admin, org, a.id);
  } catch {
    // a rotina de ida tenta de novo em alguns minutos
  }
  if (!tinhaEvento) return "sem_evento";
  return removido ? "movido" : "remocao_pendente";
}
