import { randomUUID } from "node:crypto";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RANK: Record<string, number> = { viewer: 0, agent: 1, manager: 2, admin: 3, owner: 4 };
const corpo = z.object({ event_type_id: z.string().uuid() });

/**
 * Troca o TIPO do compromisso (a tag no topo da página). O fim passa a ser o início mais a duração
 * do tipo novo; o horário, o cliente e o responsável não mudam. Só compromisso que ainda está de
 * pé, e só o responsável ou um gerente.
 */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const body = corpo.safeParse(await req.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !body.success)
    return fail("validation_failed", "Informe o tipo.", 422, { requestId });
  const org = auth.org.orgId;
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("calendar_appointments")
    .select("id,status,revision,owner_user_id,starts_at,ends_at,event_type_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!a) return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  if (a.owner_user_id !== auth.user.id && (RANK[auth.org.role] ?? 0) < RANK.manager!)
    return fail("forbidden", "Só o responsável ou um gerente muda o tipo.", 403, { requestId });
  if (a.status !== "pending" && a.status !== "confirmed")
    return fail("validation_failed", "Só dá para mudar o tipo de um compromisso em aberto.", 422, {
      requestId,
    });
  if (a.event_type_id === body.data.event_type_id)
    return ok({ id, inalterado: true }, { requestId });

  const { data: tipo } = await admin
    .from("calendar_event_types")
    .select("id,duration_minutes,is_active")
    .eq("organization_id", org)
    .eq("id", body.data.event_type_id)
    .maybeSingle();
  if (!tipo || !tipo.is_active)
    return fail("not_found", "Tipo de agendamento não encontrado.", 404, { requestId });

  const { error } = await admin
    .from("calendar_appointments")
    .update({ event_type_id: tipo.id })
    .eq("organization_id", org)
    .eq("id", id);
  if (error) return fail("internal_error", "Não foi possível trocar o tipo.", 500, { requestId });

  const novoFim = new Date(Date.parse(a.starts_at as string) + tipo.duration_minutes * 60_000);
  if (novoFim.getTime() !== Date.parse(a.ends_at as string)) {
    const { data: fresco } = await admin
      .from("calendar_appointments")
      .select("revision")
      .eq("organization_id", org)
      .eq("id", id)
      .maybeSingle();
    const { error: erroFim } = await admin.rpc("fn_appointment_change", {
      p_org: org,
      p_id: id,
      p_revision: Number(fresco?.revision ?? a.revision),
      p_patch: { ends_at: novoFim.toISOString() },
    });
    if (erroFim)
      return fail("internal_error", "O tipo mudou, mas não foi possível ajustar o fim.", 500, {
        requestId,
      });
  }

  void audit({
    action: "agenda.appointment_type_changed",
    actorUserId: auth.user.id,
    organizationId: org,
    resourceType: "calendar_appointment",
    resourceId: id,
    requestId,
    metadata: { de: a.event_type_id, para: tipo.id },
  });
  return ok({ id, event_type_id: tipo.id }, { requestId });
}
