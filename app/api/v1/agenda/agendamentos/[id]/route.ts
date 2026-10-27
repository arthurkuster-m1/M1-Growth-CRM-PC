import { readServiceBoundarySupabase } from "@/lib/atendimento/origem";
import { meetingDeliverySchema, meetingAuthorizationCurrent } from "@/lib/agenda/google/meet";
import { conflictSchema } from "@/lib/agenda/google/sync-model";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { reconcileAppointment } from "@/lib/agenda/google/sync-executor";
import { audit } from "@/lib/audit";
import { tagDeIdioma } from "@/lib/i18n/datas";
import { traduzir } from "@/lib/i18n/dicionario";
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const auth = await requireRole("viewer", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  const db = await createClient();
  const org = auth.org.orgId;
  const { data, error } = await db
    .from("calendar_appointments")
    .select(
      "id,title,description,notes,location_kind,location_details,meeting_state,meeting_url,meeting_request_id,meeting_last_error,meeting_delivery,meeting_delivery_job_id,contact_id,conversation_id,starts_at,ends_at,time_zone,status,revision,revision_started_at,outcome_user_id,outcome_source_kind,outcome_message_id,outcome_recorded_at,confirmation_next_at,cancellation_reason,owner_user_id,google_domain_revision:revision::text,google_local_revision::text,google_synced_local_revision::text,google_etag,google_synced_at,google_sync_error,google_conflict",
    )
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (error)
    return fail("internal_error", "Não foi possível carregar o compromisso.", 500, { requestId });
  if (!data)
    return fail("not_found", "Este compromisso está indisponível para você.", 404, { requestId });
  // Só depois de provar a entidade pela sessão. Recibo privado não é listável.
  const recovery = await createAdminClient()
    .from("appointment_recovery_receipts")
    .select("result,enrollment_id,invalidated_at,recorded_at")
    .eq("organization_id", org)
    .eq("appointment_id", id)
    .eq("appointment_revision", data.revision)
    .maybeSingle();
  if (recovery.error)
    return fail("internal_error", "Não foi possível carregar o próximo passo.", 500, { requestId });
  const enrollment = recovery.data?.enrollment_id
    ? await createAdminClient()
        .from("followup_enrollments")
        .select("status,cancel_reason")
        .eq("organization_id", org)
        .eq("id", recovery.data.enrollment_id)
        .maybeSingle()
    : { data: null, error: null };
  if (enrollment.error)
    return fail("internal_error", "Não foi possível carregar o acompanhamento.", 500, {
      requestId,
    });
  const messages = data.contact_id
    ? await db
        .from("messages")
        .select("id,body,sent_at")
        .eq("organization_id", org)
        .eq("contact_id", data.contact_id)
        .eq("direction", "inbound")
        .not("service_revision", "is", null)
        .gte("created_at", data.revision_started_at)
        .order("sent_at", { ascending: false })
        .limit(20)
    : { data: [], error: null };
  if (messages.error)
    return fail("internal_error", "Não foi possível carregar as mensagens de confirmação.", 500, {
      requestId,
    });
  const delivery = meetingDeliverySchema.safeParse(data.meeting_delivery);
  const deliveryJob =
    delivery.success && delivery.data.state === "queued" && data.meeting_delivery_job_id
      ? await db
          .from("job_queue")
          .select("status")
          .eq("organization_id", org)
          .eq("id", data.meeting_delivery_job_id)
          .maybeSingle()
      : { data: null, error: null };
  if (deliveryJob.error)
    return fail("internal_error", "Não foi possível conferir o envio do link.", 500, { requestId });
  const deliveryState = delivery.success
    ? delivery.data.state === "queued" &&
      !["pending", "running"].includes(deliveryJob.data?.status ?? "")
      ? "failed"
      : delivery.data.state
    : "none";
  const destinations =
    data.contact_id && data.owner_user_id === auth.user.id
      ? await db
          .from("conversations")
          .select("id,created_at,channel_session_id,contacts(name,phone_number)")
          .eq("organization_id", org)
          .eq("contact_id", data.contact_id)
          .eq("is_group", false)
          .not("status", "in", "(closed,resolved,archived)")
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [], error: null };
  if (destinations.error)
    return fail("internal_error", "Não foi possível carregar as conversas de destino.", 500, {
      requestId,
    });
  const originalBoundary = delivery.success ? (delivery.data.service_boundary ?? null) : null;
  let authorizationCurrent = false;
  if (
    originalBoundary &&
    destinations.data?.some(
      (d) =>
        d.id === originalBoundary.conversation_id &&
        delivery.success &&
        d.channel_session_id === delivery.data.channel_session_id,
    )
  ) {
    try {
      authorizationCurrent = meetingAuthorizationCurrent(
        originalBoundary,
        await readServiceBoundarySupabase(
          createAdminClient(),
          org,
          originalBoundary.conversation_id,
        ),
      );
    } catch {
      return fail("internal_error", "Não foi possível conferir o atendimento do envio.", 500, {
        requestId,
      });
    }
  }
  // O BLOCO DE ENVIO DEIXA DE SER SÓ DO MEET. Ele era `null` para qualquer
  // outro local, e é por isso que a seção nem aparecia na tela de um
  // compromisso presencial: não havia como mandar os dados ao cliente pelo
  // CRM. A condição passa a ser ter CONTATO — sem contato não há a quem
  // mandar —, e `location_kind` viaja para a tela decidir o que prometer.
  const meeting = data.contact_id
    ? {
        location_kind: data.location_kind,
        state: data.meeting_state,
        url: data.meeting_state === "ready" ? data.meeting_url : null,
        request_id: data.meeting_request_id,
        error: data.meeting_last_error,
        delivery_state: deliveryState,
        delivery_error: delivery.success ? (delivery.data.error ?? null) : null,
        delivery_authorization_current: authorizationCurrent,
        delivery_conversation_id: delivery.success
          ? (delivery.data.service_boundary?.conversation_id ?? null)
          : null,
        can_manage: data.owner_user_id === auth.user.id,
        destinations: (destinations.data ?? []).map((d) => {
          const contact = Array.isArray(d.contacts) ? d.contacts[0] : d.contacts;
          return {
            id: d.id,
            label: `${contact?.name ?? traduzir("Contato", auth.user.idioma)}${contact?.phone_number ? ` — ${contact.phone_number}` : ""} — ${new Date(d.created_at).toLocaleDateString(tagDeIdioma(auth.user.idioma))}`,
          };
        }),
      }
    : null;
  const {
    meeting_delivery_job_id: _deliveryJob,
    meeting_delivery: _privateDelivery,
    meeting_request_id: _request,
    meeting_last_error: _error,
    meeting_state: _state,
    meeting_url: _url,
    google_domain_revision,
    google_conflict,
    google_local_revision,
    google_synced_local_revision,
    google_etag,
    google_synced_at,
    google_sync_error,
    owner_user_id,
    ...detail
  } = data;
  const conflict = conflictSchema.safeParse(google_conflict);
  // Para a página do compromisso: quem é o cliente, qual a oportunidade, o tipo e o responsável.
  const [cli, vinc, tipoLinha, sucessor] = await Promise.all([
    data.contact_id
      ? db
          .from("contacts")
          .select("name,display_name,phone_number,email")
          .eq("organization_id", org)
          .eq("id", data.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("crm_lead_links")
      .select("lead_id")
      .eq("organization_id", org)
      .eq("target_kind", "appointment")
      .eq("target_id", id)
      .limit(1),
    db
      .from("calendar_appointments")
      .select("calendar_event_types(id,name,slug,color)")
      .eq("organization_id", org)
      .eq("id", id)
      .maybeSingle(),
    // Se este compromisso foi remarcado, o novo nasceu apontando para ele (`rescheduled_from_id`).
    db
      .from("calendar_appointments")
      .select("id")
      .eq("organization_id", org)
      .eq("rescheduled_from_id", id)
      .limit(1)
      .maybeSingle(),
  ]);
  const tipoRaw = (tipoLinha.data as { calendar_event_types?: unknown } | null)
    ?.calendar_event_types;
  const tipoDoCompromisso = (Array.isArray(tipoRaw) ? tipoRaw[0] : tipoRaw) as
    { id: string; name: string; slug: string; color: string | null } | null | undefined;
  const leadDoCompromisso =
    ((vinc.data ?? [])[0] as { lead_id?: string } | undefined)?.lead_id ?? null;
  const { data: leadRow } = leadDoCompromisso
    ? await db
        .from("crm_leads")
        .select("title, nome_da_venda")
        .eq("organization_id", org)
        .eq("id", leadDoCompromisso)
        .maybeSingle()
    : { data: null };
  // Os blocos da página: leitura à parte e tolerante — a coluna chega com a atualização do banco, e
  // enquanto ela não existe a página abre normalmente com o modelo do tipo.
  const blocosLinha = await db
    .from("calendar_appointments")
    .select("blocos" as never)
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  const blocosDoCompromisso = blocosLinha.error
    ? null
    : ((blocosLinha.data as { blocos?: unknown } | null)?.blocos ?? null);
  const cliente = cli.data as {
    name?: string | null;
    display_name?: string | null;
    phone_number?: string | null;
    email?: string | null;
  } | null;
  const extra = {
    cliente: cliente
      ? {
          nome: nomeDoContato(cliente) ?? cliente.phone_number ?? null,
          telefone: cliente.phone_number ?? null,
          email: cliente.email ?? null,
        }
      : null,
    lead_id: leadDoCompromisso,
    blocos: blocosDoCompromisso,
    oportunidade_titulo:
      ((
        leadRow as { nome_da_venda?: string | null; title?: string | null } | null
      )?.nome_da_venda?.trim() ||
        (leadRow as { title?: string | null } | null)?.title?.trim()) ??
      null,
    tipo: tipoDoCompromisso
      ? {
          id: tipoDoCompromisso.id,
          nome: tipoDoCompromisso.name,
          slug: tipoDoCompromisso.slug,
          cor: tipoDoCompromisso.color,
        }
      : null,
    remarcado_para: (sucessor.data as { id?: string } | null)?.id ?? null,
    responsavel_id: owner_user_id,
    eh_responsavel: owner_user_id === auth.user.id,
  };
  return ok(
    {
      ...detail,
      ...extra,
      meeting,
      google_sync: {
        revision: google_domain_revision,
        local_revision: String(google_local_revision),
        etag: google_etag,
        synced_at: google_synced_at,
        error: google_sync_error,
        pending: BigInt(google_local_revision) > BigInt(google_synced_local_revision),
        conflict: conflict.success ? conflict.data : null,
        can_resolve: owner_user_id === auth.user.id,
      },
      recovery: recovery.data
        ? {
            ...recovery.data,
            enrollment_status: enrollment.data?.status ?? null,
            cancel_reason: enrollment.data?.cancel_reason ?? null,
          }
        : null,
      evidence_messages: messages.data,
    },
    { requestId },
  );
}

const RANK: Record<string, number> = { viewer: 0, agent: 1, manager: 2, admin: 3, owner: 4 };

/**
 * EXCLUIR de vez. Diferente de cancelar (que guarda o motivo e o histórico): aqui o compromisso
 * some da agenda, da ficha e das análises, e o evento sai do Google. Quem pode: o responsável
 * pelo compromisso ou um gerente.
 *
 * Com evento no Google, primeiro cancela e empurra o apagar para o Google; só apaga a linha
 * depois que o Google confirmou. Se o Google não responder agora, o compromisso fica cancelado
 * (já liberou o horário) e o botão Excluir vale de novo mais tarde.
 */
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  const org = auth.org.orgId;
  const admin = createAdminClient();
  const { data: a, error } = await admin
    .from("calendar_appointments")
    .select("id,status,revision,owner_user_id,google_event_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("internal_error", "Não foi possível excluir agora.", 500, { requestId });
  if (!a) return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  const ehDono = a.owner_user_id === auth.user.id;
  if (!ehDono && (RANK[auth.org.role] ?? 0) < RANK.manager!)
    return fail("forbidden", "Só o responsável ou um gerente pode excluir este compromisso.", 403, {
      requestId,
    });

  if (a.google_event_id) {
    if (a.status !== "cancelled") {
      const { error: e1 } = await admin.rpc("fn_appointment_change", {
        p_org: org,
        p_id: id,
        p_revision: Number(a.revision),
        p_patch: { status: "cancelled", cancellation_reason: "Excluído" },
      });
      if (e1)
        return fail("conflict", "O compromisso mudou. Recarregue e tente de novo.", 409, {
          requestId,
        });
    }
    let r: string;
    try {
      r = await reconcileAppointment(admin, org, id);
    } catch {
      r = "failed";
    }
    const { data: depois } = await admin
      .from("calendar_appointments")
      .select("google_event_id,needs_google_push")
      .eq("organization_id", org)
      .eq("id", id)
      .maybeSingle();
    if (r !== "processed" && r !== "terminal" && depois?.needs_google_push)
      return fail(
        "google_pendente",
        "O compromisso foi cancelado, mas o Google ainda não confirmou a remoção. Tente excluir de novo em alguns minutos.",
        202,
        { requestId },
      );
  }

  const { error: del } = await admin
    .from("calendar_appointments")
    .delete()
    .eq("organization_id", org)
    .eq("id", id);
  if (del)
    return fail(
      "internal_error",
      "Este compromisso tem registros ligados e não pôde ser apagado. Ele ficou cancelado.",
      409,
      { requestId },
    );
  void audit({
    action: "agenda.appointment_updated",
    actorUserId: auth.user.id,
    organizationId: org,
    resourceType: "calendar_appointment",
    resourceId: id,
    requestId,
    metadata: { excluido: true },
  });
  return ok({ id, excluido: true }, { requestId });
}
