import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RANK: Record<string, number> = { viewer: 0, agent: 1, manager: 2, admin: 3, owner: 4 };
/** Os tipos de local que se escolhem na página; o Google Meet nasce da integração, não se digita. */
const corpo = z.object({
  location_kind: z.enum(["in_person", "phone", "whatsapp", "video_link"]),
  location_details: z.string().trim().max(500),
});

/**
 * Edita o LOCAL deste compromisso: o tipo (presencial, link, telefone, WhatsApp) e o endereço ou o
 * link. Vale só para ele — o tipo de atendimento não muda. Só o responsável ou um gerente.
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
    return fail("validation_failed", "Informe o local.", 422, { requestId });
  const org = auth.org.orgId;
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("calendar_appointments")
    .select("id,owner_user_id,status")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!a) return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  if (a.owner_user_id !== auth.user.id && (RANK[auth.org.role] ?? 0) < RANK.manager!)
    return fail("forbidden", "Só o responsável ou um gerente muda o local.", 403, { requestId });
  if (a.status === "cancelled")
    return fail("validation_failed", "Este compromisso foi cancelado.", 422, { requestId });
  const { error } = await admin
    .from("calendar_appointments")
    .update({
      location_kind: body.data.location_kind,
      location_details: body.data.location_details || null,
    })
    .eq("organization_id", org)
    .eq("id", id);
  if (error) return fail("internal_error", "Não foi possível salvar o local.", 500, { requestId });
  return ok({ id, ...body.data }, { requestId });
}
