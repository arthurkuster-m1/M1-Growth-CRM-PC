import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { moverEventoParaOutroResponsavel } from "@/lib/agenda/google/mover-responsavel";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RANK: Record<string, number> = { viewer: 0, agent: 1, manager: 2, admin: 3, owner: 4 };
const corpo = z.object({ user_id: z.string().uuid() });

/**
 * Troca QUEM atende este compromisso, e só ele. O responsável da oportunidade e o do relacionamento
 * com o cliente continuam como estão (o atendente pode faltar e outra pessoa assumir a reunião).
 *
 * Quem pode: o responsável atual ou um gerente. O novo responsável precisa ser da equipe e estar
 * livre naquele horário. O evento do Google sai da agenda do anterior e entra na do novo (sem
 * Google conectado no novo, fica só na agenda do app).
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
    return fail("validation_failed", "Informe o novo responsável.", 422, { requestId });
  const org = auth.org.orgId;
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("calendar_appointments")
    .select("id,status,starts_at,ends_at,owner_user_id,google_event_id,google_connection_id,google_calendar_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!a) return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  if (a.owner_user_id !== auth.user.id && (RANK[auth.org.role] ?? 0) < RANK.manager!)
    return fail("forbidden", "Só o responsável atual ou um gerente troca o responsável.", 403, { requestId });
  if (["cancelled", "completed", "no_show"].includes(a.status as string))
    return fail("conflict", "Este compromisso já foi encerrado.", 409, { requestId });
  if (a.owner_user_id === body.data.user_id) return ok({ id, responsavel_id: a.owner_user_id }, { requestId });

  const { data: membro } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", org)
    .eq("user_id", body.data.user_id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!membro) return fail("validation_failed", "Essa pessoa não é da equipe.", 422, { requestId });

  const { data: choque } = await admin
    .from("calendar_appointments")
    .select("id")
    .eq("organization_id", org)
    .eq("owner_user_id", body.data.user_id)
    .in("status", ["pending", "confirmed"])
    .neq("id", id)
    .lt("starts_at", a.ends_at as string)
    .gt("ends_at", a.starts_at as string)
    .limit(1);
  if (choque?.length)
    return fail("conflict", "Essa pessoa já tem um compromisso nesse horário.", 409, { requestId });

  let google: string;
  try {
    google = await moverEventoParaOutroResponsavel(
      admin,
      org,
      {
        id,
        google_event_id: (a.google_event_id as string | null) ?? null,
        google_connection_id: (a.google_connection_id as string | null) ?? null,
        google_calendar_id: (a.google_calendar_id as string | null) ?? null,
      },
      body.data.user_id,
    );
  } catch {
    return fail("internal_error", "Não foi possível trocar o responsável.", 500, { requestId });
  }
  void audit({
    action: "agenda.appointment_updated",
    actorUserId: auth.user.id,
    organizationId: org,
    resourceType: "calendar_appointment",
    resourceId: id,
    requestId,
    metadata: { owner_user_id: body.data.user_id, de: a.owner_user_id },
  });
  return ok({ id, responsavel_id: body.data.user_id, google }, { requestId });
}
