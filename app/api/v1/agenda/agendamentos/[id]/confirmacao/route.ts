import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { aplicarFluxoAntiNoShow } from "@/lib/agenda/anti-no-show";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RANK: Record<string, number> = { viewer: 0, agent: 1, manager: 2, admin: 3, owner: 4 };

/**
 * "Confirmado": a equipe registra que o cliente confirmou presença (por ligação, mensagem, etc.).
 * Grava a mesma marca que a resposta ao lembrete grava (`client_confirmation = confirmed`) e, se o
 * compromisso estava aguardando confirmação, passa para Agendado.
 */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
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
  const { data: a } = await admin
    .from("calendar_appointments")
    .select("id,status,revision,owner_user_id,client_confirmation,event_type_id,contact_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!a) return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  if (a.owner_user_id !== auth.user.id && (RANK[auth.org.role] ?? 0) < RANK.manager!)
    return fail("forbidden", "Só o responsável ou um gerente pode confirmar este compromisso.", 403, {
      requestId,
    });
  if (a.status === "cancelled" || a.status === "completed" || a.status === "no_show")
    return fail("conflict", "Este compromisso já foi encerrado.", 409, { requestId });
  if (a.status === "pending") {
    const { error } = await admin.rpc("fn_appointment_change", {
      p_org: org,
      p_id: id,
      p_revision: Number(a.revision),
      p_patch: { status: "confirmed" },
    });
    if (error)
      return fail("conflict", "O compromisso mudou. Recarregue e tente de novo.", 409, { requestId });
  }
  const { error: e2 } = await admin
    .from("calendar_appointments")
    .update({ client_confirmation: "confirmed", client_confirmed_at: new Date().toISOString() })
    .eq("organization_id", org)
    .eq("id", id);
  if (e2) return fail("internal_error", "Não foi possível registrar a confirmação.", 500, { requestId });
  await aplicarFluxoAntiNoShow(admin, {
    organizationId: org,
    appointmentId: id,
    eventTypeId: (a.event_type_id as string | null) ?? null,
    contactId: (a.contact_id as string | null) ?? null,
    evento: "confirmou",
  });
  void audit({
    action: "agenda.appointment_updated",
    actorUserId: auth.user.id,
    organizationId: org,
    resourceType: "calendar_appointment",
    resourceId: id,
    requestId,
    metadata: { client_confirmation: "confirmed", by: "equipe" },
  });
  return ok({ id, confirmado: true }, { requestId });
}
