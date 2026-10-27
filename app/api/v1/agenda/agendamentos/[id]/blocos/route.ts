import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { blocosSchema } from "@/lib/marketing/blocos";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RANK: Record<string, number> = { viewer: 0, agent: 1, manager: 2, admin: 3, owner: 4 };
const corpo = z.object({ blocos: blocosSchema.nullable() });

/**
 * Grava os BLOCOS da página deste compromisso — as anotações e adaptações feitas só nele. `null`
 * devolve o compromisso ao modelo do tipo. Só o responsável ou um gerente; vale também para
 * compromisso já encerrado (as anotações da reunião se escrevem depois dela).
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
    return fail("validation_failed", "Blocos inválidos.", 422, { requestId });
  const org = auth.org.orgId;
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("calendar_appointments")
    .select("id,owner_user_id")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (!a) return fail("not_found", "Compromisso indisponível.", 404, { requestId });
  if (a.owner_user_id !== auth.user.id && (RANK[auth.org.role] ?? 0) < RANK.manager!)
    return fail("forbidden", "Só o responsável ou um gerente edita as anotações.", 403, {
      requestId,
    });
  const { error } = await admin
    .from("calendar_appointments")
    .update({ blocos: body.data.blocos } as never)
    .eq("organization_id", org)
    .eq("id", id);
  if (error)
    return fail("internal_error", "Não foi possível salvar as anotações.", 500, { requestId });
  return ok({ id }, { requestId });
}
