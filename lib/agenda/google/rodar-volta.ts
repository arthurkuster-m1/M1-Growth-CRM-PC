import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshCatalog, syncCalendar } from "@/lib/agenda/google/calendar-executor";
import { apenasDeMembrosAtivos } from "@/lib/agenda/google/membros";
import { audit } from "@/lib/audit";

/**
 * A volta (Google → app). Com `organizationId`, só as contas dessa empresa e sem esperar o
 * prazo de cada agenda (`forcar`): é o botão "Sincronizar com Google".
 */
export async function rodarVoltaDoGoogle(
  db: SupabaseClient,
  opcoes: { organizationId?: string; forcar?: boolean } = {},
): Promise<{ ok: boolean; conexoes: number; organizacoes: number }> {
  let consulta = db
    .from("calendar_connections")
    .select("id,organization_id,user_id,calendar_selection_revision")
    .eq("status", "healthy")
    .eq("provider", "google_calendar");
  if (opcoes.organizationId) consulta = consulta.eq("organization_id", opcoes.organizationId);
  const { data: raw, error } = await consulta.order("updated_at").limit(25);
  if (error) return { ok: false, conexoes: 0, organizacoes: 0 };
  const connections = await apenasDeMembrosAtivos(db, raw ?? []);
  const effects = new Map<string, number>();
  let remainingCalendars = 25;
  for (const connection of connections) {
    if (remainingCalendars === 0) break;
    const org = connection.organization_id;
    let complete = true;
    let completedCalendars = 0;
    try {
      const { data: catalog } = await db
        .from("calendar_connection_calendars")
        .select("catalog_checked_at")
        .eq("organization_id", org)
        .eq("connection_id", connection.id)
        .order("catalog_checked_at", { nullsFirst: true })
        .limit(1);
      if (
        !catalog?.[0]?.catalog_checked_at ||
        Date.parse(catalog[0].catalog_checked_at) < Date.now() - 86_400_000
      ) {
        await refreshCatalog(db, org, connection.id);
        effects.set(org, (effects.get(org) ?? 0) + 1);
      }
      let consultaDeAgendas = db
        .from("calendar_connection_calendars")
        .select("id,external_calendar_id,counts_for_conflicts,is_destination")
        .eq("organization_id", org)
        .eq("connection_id", connection.id)
        .eq("available", true);
      if (!opcoes.forcar)
        consultaDeAgendas = consultaDeAgendas.lte("sync_next_attempt_at", new Date().toISOString());
      const { data: calendars, error: calendarError } = await consultaDeAgendas
        .order("sync_next_attempt_at")
        .limit(remainingCalendars);
      if (calendarError) throw calendarError;
      for (const calendar of calendars ?? []) {
        if (!calendar.counts_for_conflicts && !calendar.is_destination) {
          const { data: linked, error: linkError } = await db
            .from("calendar_google_reconcilable_appointments")
            .select("id")
            .eq("organization_id", org)
            .eq("google_connection_id", connection.id)
            .eq("google_calendar_id", calendar.external_calendar_id)
            .limit(1);
          if (linkError) throw linkError;
          if (!linked?.length) {
            // Sem consumidor agora: retire do início do lote. Uma escolha
            // futura rearma o prazo na própria RPC de seleção.
            const { error: deferredError } = await db
              .from("calendar_connection_calendars")
              .update({ sync_next_attempt_at: new Date(Date.now() + 86_400_000).toISOString() })
              .eq("organization_id", org)
              .eq("connection_id", connection.id)
              .eq("id", calendar.id);
            if (deferredError) throw deferredError;
            continue;
          }
        }
        remainingCalendars -= 1;
        const result = await syncCalendar(db, org, calendar.id);
        if (result !== "complete") complete = false;
        else completedCalendars += 1;
        if (result !== "busy") effects.set(org, (effects.get(org) ?? 0) + 1);
        // O marco da PRÓPRIA leitura desta agenda. `last_sync_at` é por agenda,
        // não por conta: quem só bloqueia horário foi lida na mesma rodada que a
        // de destino, e a tela ("Ainda não sincronizada") não pode dizer o
        // contrário. Só quem leu de verdade carimba: `busy` não leu nada (outra
        // rodada segura a aquisição ou a agenda está indisponível) e `failed`
        // não terminou — nesse caso é a `sync_error` da própria linha que conta
        // o que houve, e um carimbo aqui mentiria. `partial` avançou um
        // checkpoint do ciclo (página gravada no cursor), então é leitura real.
        if (result === "complete" || result === "partial") {
          const { error: stampError } = await db
            .from("calendar_connection_calendars")
            .update({ last_sync_at: new Date().toISOString() })
            .eq("organization_id", org)
            .eq("connection_id", connection.id)
            .eq("id", calendar.id);
          if (stampError) throw stampError;
        }
      }
      await db
        .from("calendar_connections")
        .update({
          updated_at: new Date().toISOString(),
          ...(complete && completedCalendars > 0
            ? { last_sync_error: null, last_sync_at: new Date().toISOString() }
            : {}),
        })
        .eq("organization_id", org)
        .eq("id", connection.id);
    } catch {
      await db
        .from("calendar_connections")
        .update({
          last_sync_error:
            "Não foi possível atualizar as agendas. Confira a conexão nas configurações.",
        })
        .eq("organization_id", org)
        .eq("id", connection.id);
      effects.set(org, (effects.get(org) ?? 0) + 1);
    }
  }
  for (const [organizationId, quantidade] of effects) {
    if (quantidade > 0)
      await audit({
        action: "agenda.google.sync_executado",
        organizationId,
        metadata: { direcao: "volta", calendarios: quantidade },
      });
  }
  return { ok: true, conexoes: connections.length, organizacoes: effects.size };
}
