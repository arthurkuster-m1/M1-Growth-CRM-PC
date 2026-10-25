/**
 * GET /api/v1/cadence/ativos — onde cada lead em cadência está: passo, dia do passo e se está
 * atrasado. Alimenta a coluna e o filtro "Cadência" das oportunidades do CRM. A empresa lê.
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { ordenarPassos } from "@/lib/cadencia/cadencia";
import type { LeadEmCadencia } from "@/lib/cadencia/hoje";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIMITE = 5000;

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

  const { data: inscricoes, error } = await supabase
    .from("demand_cadence_enrollments")
    .select("lead_id, cadence_id, current_step, next_due_at")
    .eq("organization_id", orgId)
    .eq("status", "ativa")
    .limit(LIMITE);
  if (error) return fail("internal_error", t("Erro ao carregar a cadência."), 500, { requestId });
  const lista = (inscricoes ?? []) as Array<{
    lead_id: string;
    cadence_id: string;
    current_step: number;
    next_due_at: string | null;
  }>;
  if (lista.length === 0) return ok({ leads: [] as LeadEmCadencia[] }, { requestId });

  const cadencias = [...new Set(lista.map((i) => i.cadence_id))];
  const { data: brutos } = await supabase
    .from("demand_cadence_steps")
    .select("cadence_id, position, day_offset")
    .eq("organization_id", orgId)
    .in("cadence_id", cadencias)
    .order("position", { ascending: true })
    .limit(5000);
  const porCadencia = new Map<string, Array<{ day_offset: number }>>();
  for (const p of (brutos ?? []) as Array<{ cadence_id: string; day_offset: number }>) {
    porCadencia.set(p.cadence_id, [...(porCadencia.get(p.cadence_id) ?? []), p]);
  }

  const agora = Date.now();
  const leads: LeadEmCadencia[] = lista.map((i) => {
    const desenho = ordenarPassos(porCadencia.get(i.cadence_id) ?? []);
    const noPrazo = i.current_step >= desenho.length;
    return {
      lead_id: i.lead_id,
      passo: Math.min(i.current_step + 1, Math.max(desenho.length, 1)),
      total: desenho.length,
      dia: noPrazo ? null : (desenho[i.current_step]?.day_offset ?? null),
      aguardando: noPrazo,
      atrasado: !noPrazo && i.next_due_at !== null && new Date(i.next_due_at).getTime() < agora,
    };
  });
  return ok({ leads }, { requestId });
}
