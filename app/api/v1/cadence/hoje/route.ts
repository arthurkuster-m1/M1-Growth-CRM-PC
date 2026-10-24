/**
 * GET /api/v1/cadence/hoje — os passos de cadência que vencem até amanhã (o cliente separa o que é
 * de hoje, do que está atrasado): lead, passo, meio, abordagem e observação. A empresa lê.
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import type { PassoDeHoje } from "@/lib/cadencia/hoje";
import { ordenarPassos } from "@/lib/cadencia/cadencia";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIMITE = 2000;

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "demand_campaigns",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const orgId = authz.org.orgId;
  const supabase = await createClient();

  const ate = new Date(Date.now() + 86_400_000).toISOString();
  const { data: inscricoes, error } = await supabase
    .from("demand_cadence_enrollments")
    .select("lead_id, cadence_id, current_step, next_due_at")
    .eq("organization_id", orgId)
    .eq("status", "ativa")
    .lte("next_due_at", ate)
    .order("next_due_at", { ascending: true })
    .limit(LIMITE);
  if (error) {
    return fail("internal_error", t("Erro ao carregar a cadência de hoje."), 500, { requestId });
  }
  const lista = (inscricoes ?? []) as Array<{
    lead_id: string;
    cadence_id: string;
    current_step: number;
    next_due_at: string;
  }>;
  if (lista.length === 0) return ok({ passos: [] as PassoDeHoje[] }, { requestId });

  const cadencias = [...new Set(lista.map((i) => i.cadence_id))];
  const { data: brutos } = await supabase
    .from("demand_cadence_steps")
    .select("cadence_id, position, day_offset, medium, approach_id, note")
    .eq("organization_id", orgId)
    .in("cadence_id", cadencias)
    .order("position", { ascending: true })
    .limit(5000);
  type Passo = {
    cadence_id: string;
    position: number;
    day_offset: number;
    medium: PassoDeHoje["medium"];
    approach_id: string | null;
    note: string;
  };
  const porCadencia = new Map<string, Passo[]>();
  for (const p of (brutos ?? []) as Passo[]) {
    porCadencia.set(p.cadence_id, [...(porCadencia.get(p.cadence_id) ?? []), p]);
  }

  const idsDeAbordagem = [
    ...new Set(((brutos ?? []) as Passo[]).flatMap((p) => (p.approach_id ? [p.approach_id] : []))),
  ];
  const { data: abordagens } = idsDeAbordagem.length
    ? await supabase
        .from("demand_campaign_approaches")
        .select("id, name, hook, script")
        .eq("organization_id", orgId)
        .in("id", idsDeAbordagem)
    : { data: [] };
  const abPorId = new Map(
    ((abordagens ?? []) as Array<{ id: string; name: string; hook: string; script: string }>).map(
      (a) => [a.id, a] as const,
    ),
  );

  const passos: PassoDeHoje[] = [];
  for (const i of lista) {
    const desenho = ordenarPassos(porCadencia.get(i.cadence_id) ?? []);
    const passo = desenho[i.current_step];
    // Passou do último passo: está no prazo de resposta, não há o que fazer hoje.
    if (!passo) continue;
    passos.push({
      lead_id: i.lead_id,
      passo: i.current_step + 1,
      total: desenho.length,
      medium: passo.medium,
      nota: passo.note,
      abordagem: passo.approach_id ? (abPorId.get(passo.approach_id) ?? null) : null,
      vence_em: i.next_due_at,
    });
  }
  return ok({ passos }, { requestId });
}
