import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET — a oportunidade ligada ao compromisso, com as ETAPAS do funil dela (para trocar a etapa
 * pela página do compromisso). Sem oportunidade ligada, `lead` vem nulo.
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const auth = await requireRole("viewer", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  const org = auth.org.orgId;
  const db = await createClient();
  const { data: vinculo } = await db
    .from("crm_lead_links")
    .select("lead_id")
    .eq("organization_id", org)
    .eq("target_kind", "appointment")
    .eq("target_id", id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const leadId = (vinculo as { lead_id?: string } | null)?.lead_id;
  if (!leadId) return ok({ lead: null, etapas: [] }, { requestId });
  const { data: lead } = await db
    .from("crm_leads")
    .select(
      "id, pipeline_id, stage_id, status, updated_at, proxima_acao, proxima_acao_em, expected_close_date",
    )
    .eq("organization_id", org)
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return ok({ lead: null, etapas: [] }, { requestId });
  const { data: etapas } = await db
    .from("crm_stages")
    .select("id, name, color, position, is_won, is_lost, qualification")
    .eq("organization_id", org)
    .eq("pipeline_id", (lead as { pipeline_id: string }).pipeline_id)
    .eq("is_archived", false)
    .order("position", { ascending: true });
  return ok({ lead, etapas: etapas ?? [] }, { requestId });
}

const RANK: Record<string, number> = { viewer: 0, agent: 1, manager: 2, admin: 3, owner: 4 };
const corpo = z.object({ lead_id: z.string().uuid().nullable() });

/** Liga o compromisso a outra oportunidade DO MESMO CLIENTE (ou o deixa só no cliente). */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const body = corpo.safeParse(await req.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !body.success)
    return fail("validation_failed", "Informe a oportunidade.", 422, { requestId });
  const org = auth.org.orgId;
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("calendar_appointments")
    .select("id,contact_id,owner_user_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!a) return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  if (a.owner_user_id !== auth.user.id && (RANK[auth.org.role] ?? 0) < RANK.manager!)
    return fail("forbidden", "Só o responsável ou um gerente muda a oportunidade.", 403, {
      requestId,
    });

  if (body.data.lead_id) {
    const { data: lead } = await admin
      .from("crm_leads")
      .select("id,contact_id")
      .eq("organization_id", org)
      .eq("id", body.data.lead_id)
      .maybeSingle();
    if (!lead || lead.contact_id !== a.contact_id)
      return fail("validation_failed", "Essa oportunidade não é deste cliente.", 422, {
        requestId,
      });
  }
  await admin
    .from("crm_lead_links")
    .delete()
    .eq("organization_id", org)
    .eq("target_kind", "appointment")
    .eq("target_id", id);
  if (body.data.lead_id) {
    const { error } = await admin.from("crm_lead_links").insert({
      organization_id: org,
      lead_id: body.data.lead_id,
      target_kind: "appointment",
      target_id: id,
      link_kind: "scheduled",
      created_by_user_id: auth.user.id,
    });
    if (error)
      return fail("internal_error", "Não foi possível ligar a oportunidade.", 500, { requestId });
  }
  return ok({ id, lead_id: body.data.lead_id }, { requestId });
}
