import { randomUUID } from "node:crypto";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RANK: Record<string, number> = { viewer: 0, agent: 1, manager: 2, admin: 3, owner: 4 };
const corpo = z.object({ contact_id: z.string().uuid() });

/**
 * Troca o CLIENTE do compromisso. A oportunidade é sempre do cliente: ao trocar, a ligação antiga
 * sai e o compromisso passa à oportunidade aberta mais recente do cliente novo (ou fica só no
 * cliente, se ele não tiver) — e, por ela, a venda. A conversa ligada era do cliente antigo e sai.
 * Só compromisso em aberto, e só o responsável ou um gerente.
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
    return fail("validation_failed", "Informe o cliente.", 422, { requestId });
  const org = auth.org.orgId;
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("calendar_appointments")
    .select("id,status,owner_user_id,contact_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!a) return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  if (a.owner_user_id !== auth.user.id && (RANK[auth.org.role] ?? 0) < RANK.manager!)
    return fail("forbidden", "Só o responsável ou um gerente muda o cliente.", 403, { requestId });
  if (a.status !== "pending" && a.status !== "confirmed")
    return fail(
      "validation_failed",
      "Só dá para mudar o cliente de um compromisso em aberto.",
      422,
      {
        requestId,
      },
    );
  if (a.contact_id === body.data.contact_id) return ok({ id, inalterado: true }, { requestId });

  const { data: contato } = await admin
    .from("contacts")
    .select("id")
    .eq("organization_id", org)
    .eq("id", body.data.contact_id)
    .maybeSingle();
  if (!contato) return fail("not_found", "Contato não encontrado.", 404, { requestId });

  const { error } = await admin
    .from("calendar_appointments")
    .update({ contact_id: contato.id, conversation_id: null })
    .eq("organization_id", org)
    .eq("id", id);
  if (error)
    return fail("internal_error", "Não foi possível trocar o cliente.", 500, { requestId });

  await admin
    .from("crm_lead_links")
    .delete()
    .eq("organization_id", org)
    .eq("target_kind", "appointment")
    .eq("target_id", id);
  const { data: lead } = await admin
    .from("crm_leads")
    .select("id")
    .eq("organization_id", org)
    .eq("contact_id", contato.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lead) {
    await admin.from("crm_lead_links").insert({
      organization_id: org,
      lead_id: lead.id,
      target_kind: "appointment",
      target_id: id,
      link_kind: "scheduled",
      created_by_user_id: auth.user.id,
    });
  }

  void audit({
    action: "agenda.appointment_client_changed",
    actorUserId: auth.user.id,
    organizationId: org,
    resourceType: "calendar_appointment",
    resourceId: id,
    requestId,
    metadata: { de: a.contact_id, para: contato.id, lead_id: lead?.id ?? null },
  });
  return ok({ id, contact_id: contato.id, lead_id: lead?.id ?? null }, { requestId });
}
