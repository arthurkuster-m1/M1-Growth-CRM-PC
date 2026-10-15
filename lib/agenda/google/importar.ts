import type { SupabaseClient } from "@supabase/supabase-js";

import { payloadDoAviso } from "@/lib/agenda/aviso-do-compromisso";
import { atividadeDaTransicao, gatilhoDaTransicao } from "@/lib/agenda/laco";
import { ALVO_DE_VINCULO_DO_AGENDAMENTO, VINCULO_DE_AGENDAMENTO } from "@/lib/agenda/tipos";
import { phoneLookupVariants } from "@/lib/channels/phone-variants";
import { moverLeadParaEtapaDeAgendamento } from "@/lib/leads/appointment-stage-move";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { logger } from "@/lib/logger";

import { ehEventoNosso } from "./escrita";
import type { EventoDoGoogle } from "./evento";
import { checkpoint, localProjection, remoteProjection } from "./sync-model";

/** Quanto antes do início um evento ainda é importado (em andamento). Passado não vira compromisso. */
const TOLERANCIA_DO_PASSADO_MS = 2 * 3_600_000;

/**
 * O evento do calendário DESTINO vira compromisso? Só o que é compromisso de verdade: confirmado
 * (não cancelado), com hora marcada (não dia inteiro), que ocupa, que não é instância de série, que
 * não foi publicado pelo próprio produto e que ainda não passou. O resto fica só como horário
 * ocupado, como os demais calendários.
 */
export function eventoImportavel(e: EventoDoGoogle, agora: number = Date.now()): boolean {
  if (!e.id || ehEventoNosso(e.id)) return false;
  if ((e.status ?? "").toLowerCase() === "cancelled") return false;
  if (e.recurringEventId || (e.recurrence?.length ?? 0) > 0) return false;
  if ((e.transparency ?? "opaque").toLowerCase() === "transparent") return false;
  const ini = e.start?.dateTime;
  const fim = e.end?.dateTime;
  if (!ini || !fim) return false;
  const i = Date.parse(ini);
  const f = Date.parse(fim);
  if (!Number.isFinite(i) || !Number.isFinite(f) || f <= i) return false;
  if (i < agora - TOLERANCIA_DO_PASSADO_MS) return false;
  const eu = (e.attendees ?? []).find((p) => (p as { self?: boolean }).self);
  if (eu && (eu.responseStatus ?? "") === "declined") return false;
  return true;
}

/** Os e-mails dos convidados que são pessoas de fora (sem organizador, sala ou o próprio dono). */
export function emailsDoEvento(e: EventoDoGoogle, donoEmail: string | null): string[] {
  const dono = donoEmail?.trim().toLowerCase() ?? "";
  return [
    ...new Set(
      (e.attendees ?? [])
        .filter((p) => !p.organizer && !(p as { resource?: boolean }).resource)
        .map((p) => p.email?.trim().toLowerCase() ?? "")
        .filter((m) => m.includes("@") && m !== dono),
    ),
  ];
}

/** Os telefones escritos no título e na descrição (qualquer formato), só dígitos. */
export function telefonesDoTexto(texto: string): string[] {
  const achados = texto.match(/\+?\d[\d\s().-]{8,}\d/g) ?? [];
  return [
    ...new Set(
      achados.map((a) => a.replace(/\D/g, "")).filter((d) => d.length >= 10 && d.length <= 13),
    ),
  ];
}

export interface ContatoDoEvento {
  contactId: string;
  via: "email" | "telefone";
}

/** Quem é o cliente do evento: pelo e-mail do convidado; senão, pelo telefone escrito nele. */
export async function contatoDoEvento(
  db: SupabaseClient,
  org: string,
  e: EventoDoGoogle,
  donoEmail: string | null,
): Promise<ContatoDoEvento | null> {
  const emails = emailsDoEvento(e, donoEmail);
  if (emails.length > 0) {
    const { data } = await db
      .from("contacts")
      .select("id")
      .eq("organization_id", org)
      .in("email_normalized", emails)
      .is("is_merged_into", null)
      .eq("is_anonymized", false)
      .limit(2);
    const lista = (data ?? []) as Array<{ id: string }>;
    if (lista.length === 1) return { contactId: lista[0]!.id, via: "email" };
  }
  const fones = telefonesDoTexto(`${e.summary ?? ""} ${e.description ?? ""}`);
  for (const fone of fones) {
    const variantes = phoneLookupVariants(fone);
    if (variantes.length === 0) continue;
    const { data } = await db
      .from("contacts")
      .select("id")
      .eq("organization_id", org)
      .in("phone_number", variantes)
      .is("is_merged_into", null)
      .eq("is_anonymized", false)
      .limit(2);
    const lista = (data ?? []) as Array<{ id: string }>;
    if (lista.length === 1) return { contactId: lista[0]!.id, via: "telefone" };
  }
  return null;
}

/**
 * Importa UM evento do calendário destino como compromisso (origem `google_sync`).
 *
 * O compromisso já nasce PUBLICADO: a base de reconciliação guarda o que o Google tem agora, então
 * a próxima rodada vê "convergido" e não reescreve nada lá. Mudou o horário ou cancelou no Google?
 * Entra pelo caminho de sempre (compromisso vinculado). Devolve o id, ou `null` se não importou.
 */
export async function importarEventoDoDestino(
  db: SupabaseClient,
  args: {
    org: string;
    connectionId: string;
    externalCalendarId: string;
    ownerUserId: string;
    donoEmail: string | null;
    fusoDoCalendario: string;
    evento: EventoDoGoogle;
  },
): Promise<string | null> {
  const { evento: e } = args;
  if (!eventoImportavel(e)) return null;
  const titulo = (e.summary ?? "").trim().slice(0, 200) || "Compromisso (Google Agenda)";
  const contato = await contatoDoEvento(db, args.org, e, args.donoEmail);
  const convidado = emailsDoEvento(e, args.donoEmail)[0] ?? null;
  const temVideo = Boolean(e.hangoutLink);
  const fuso = e.start?.timeZone || args.fusoDoCalendario;

  const { data: criado, error } = await db
    .from("calendar_appointments")
    .insert({
      organization_id: args.org,
      event_type_id: null,
      title: titulo,
      description: (e.description ?? "").trim().slice(0, 2000) || null,
      starts_at: new Date(e.start!.dateTime!).toISOString(),
      ends_at: new Date(e.end!.dateTime!).toISOString(),
      time_zone: fuso,
      status: "confirmed",
      owner_user_id: args.ownerUserId,
      contact_id: contato?.contactId ?? null,
      location_kind: temVideo ? "video_link" : "in_person",
      location_details: (e.location ?? "").trim().slice(0, 300) || null,
      meeting_url: temVideo ? e.hangoutLink : null,
      guest_email: convidado,
      created_by_kind: "sync",
      source: "google_sync",
      google_connection_id: args.connectionId,
      google_calendar_id: args.externalCalendarId,
      google_event_id: e.id,
      google_ical_uid: e.iCalUID ?? null,
    })
    .select(
      "id, organization_id, title, description, starts_at, ends_at, time_zone, status, location_kind, location_details, meeting_url, guest_email, google_ical_uid",
    )
    .single();
  if (error || !criado) {
    logger.error("[agenda] importação do evento do Google falhou", {
      org: args.org,
      evento: e.id,
      erro: error?.message,
    });
    return null;
  }

  // Já nasce publicado e convergido: base = o que o Google tem agora.
  const local = localProjection(criado as never);
  const remoto = remoteProjection(e, local, null);
  const base = checkpoint(null, local, remoto, [], true);
  await db
    .from("calendar_appointments")
    .update({
      google_base_projection: base,
      google_etag: e.etag ?? null,
      google_synced_local_revision: 1,
      google_synced_at: new Date().toISOString(),
    })
    .eq("organization_id", args.org)
    .eq("id", criado.id as string);

  // O laço: o fato volta ao CRM (oportunidade única do cliente, linha do tempo, automações).
  try {
    let leadId: string | null = null;
    if (contato) {
      const { data: abertas } = await db
        .from("crm_leads")
        .select("id")
        .eq("organization_id", args.org)
        .eq("contact_id", contato.contactId)
        .eq("status", "open")
        .limit(2);
      const lista = (abertas ?? []) as Array<{ id: string }>;
      // Só vincula quando é inequívoco; com várias abertas, fica no contato para revisão.
      if (lista.length === 1) leadId = lista[0]!.id;
    }
    const gatilho = gatilhoDaTransicao(null, "confirmed");
    if (gatilho) {
      await db.rpc("emit_event", {
        p_event_type: gatilho,
        p_entity_kind: "appointment",
        p_entity_id: criado.id,
        p_payload: payloadDoAviso({
          appointmentId: criado.id as string,
          contactId: contato?.contactId ?? null,
          transicao: "confirmed",
          fuso,
          nomeDoTipo: "Google Agenda",
          compromisso: {
            starts_at: criado.starts_at,
            ends_at: criado.ends_at,
            status: "confirmed",
            location_kind: criado.location_kind,
          },
          tipo: null,
          leadIds: leadId ? [leadId] : [],
        }),
        p_metadata: { origem: "google_sync" },
        p_organization_id: args.org,
      });
    }
    if (leadId) {
      await db.from("crm_lead_links").insert({
        organization_id: args.org,
        lead_id: leadId,
        target_kind: ALVO_DE_VINCULO_DO_AGENDAMENTO,
        target_id: criado.id,
        link_kind: VINCULO_DE_AGENDAMENTO,
        created_by_user_id: null,
      });
      const atividade = atividadeDaTransicao(null, "confirmed");
      if (atividade) {
        await emitLeadActivity(db, {
          organizationId: args.org,
          leadId,
          contactId: contato?.contactId ?? null,
          type: atividade as never,
          sourceModule: "agenda",
          sourceId: criado.id as string,
          actor: { type: "user", id: args.ownerUserId },
          reason: "Compromisso importado do Google Agenda",
        });
      }
      await moverLeadParaEtapaDeAgendamento(db, {
        organizationId: args.org,
        leadId,
        transicao: "confirmed",
      });
    }
  } catch (err) {
    logger.error("[agenda] laço do compromisso importado falhou", {
      appointment_id: criado.id,
      erro: err instanceof Error ? err.message : String(err),
    });
  }
  return criado.id as string;
}
