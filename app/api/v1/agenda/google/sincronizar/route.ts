import { randomUUID } from "node:crypto";
import { rodarIdaDoGoogle } from "@/lib/agenda/google/rodar-ida";
import { rodarVoltaDoGoogle } from "@/lib/agenda/google/rodar-volta";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Uma sincronização por empresa a cada 20 s: o botão não pode virar um disparo em massa ao Google.
const ultima = new Map<string, number>();

/** Botão "Sincronizar com Google": roda a ida e a volta já, só para a empresa de quem clicou. */
export async function POST() {
  const requestId = randomUUID();
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const org = auth.org.orgId;
  const agora = Date.now();
  if (agora - (ultima.get(org) ?? 0) < 20_000)
    return fail("rate_limited", "Aguarde alguns segundos para sincronizar de novo.", 429, {
      requestId,
    });
  ultima.set(org, agora);
  const db = createAdminClient();
  const ida = await rodarIdaDoGoogle(db, org);
  const volta = await rodarVoltaDoGoogle(db, { organizationId: org, forcar: true });
  if (!ida.ok || !volta.ok)
    return fail("internal_error", "Não foi possível sincronizar com o Google agora.", 500, {
      requestId,
    });
  return ok({ enviados: ida.candidatos, contas: volta.conexoes }, { requestId });
}
