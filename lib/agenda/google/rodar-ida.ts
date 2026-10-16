import type { SupabaseClient } from "@supabase/supabase-js";
import { googlePushCandidates } from "@/lib/agenda/google/candidates";
import { apenasDeMembrosAtivos } from "@/lib/agenda/google/membros";
import { reconcileAppointment } from "@/lib/agenda/google/sync-executor";
import { audit } from "@/lib/audit";

/** A ida (app → Google). Com `organizationId`, só os compromissos dessa empresa. */
export async function rodarIdaDoGoogle(
  db: SupabaseClient,
  organizationId?: string,
): Promise<{ ok: boolean; candidatos: number; organizacoes: number }> {
  const { data: todos, error } = await googlePushCandidates(db);
  if (error) return { ok: false, candidatos: 0, organizacoes: 0 };
  const data = organizationId
    ? (todos ?? []).filter((c) => c.organization_id === organizationId)
    : todos;
  const effects = new Map<string, { processados: number; falhas: number }>();
  const active = await apenasDeMembrosAtivos(db, data ?? []);
  for (const item of active) {
    let result: string;
    try {
      result = await reconcileAppointment(db, item.organization_id, item.id);
    } catch {
      result = "failed";
    }
    if (result === "busy" || result === "unchanged" || result === "terminal") continue;
    const summary = effects.get(item.organization_id) ?? { processados: 0, falhas: 0 };
    if (result === "processed") summary.processados++;
    else summary.falhas++;
    effects.set(item.organization_id, summary);
  }
  for (const [organizationId, summary] of effects) {
    if (summary.processados > 0 || summary.falhas > 0)
      await audit({
        action: "agenda.google.sync_executado",
        organizationId,
        metadata: { direcao: "ida", ...summary },
      });
  }
  return { ok: true, candidatos: data?.length ?? 0, organizacoes: effects.size };
}
