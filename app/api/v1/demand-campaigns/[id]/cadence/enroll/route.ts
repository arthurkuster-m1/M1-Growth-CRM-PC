/**
 * POST /api/v1/demand-campaigns/[id]/cadence/enroll — inscreve na cadência os leads da campanha que
 * JÁ estão na etapa Abordagem e ainda não têm inscrição ativa (manager+). Quem entra na etapa
 * depois é inscrito sozinho pelo banco; esta porta é só para o que já estava lá.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { ordenarPassos } from "@/lib/cadencia/cadencia";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const LIMITE = 2000;

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);

  const { data: cad } = await a.supabase
    .from("demand_cadences")
    .select("id")
    .eq("organization_id", a.orgId)
    .eq("campaign_id", id)
    .maybeSingle();
  const { data: passos } = cad
    ? await a.supabase
        .from("demand_cadence_steps")
        .select("day_offset")
        .eq("organization_id", a.orgId)
        .eq("cadence_id", cad.id as string)
        .limit(100)
    : { data: [] };
  const primeiro = ordenarPassos((passos ?? []) as Array<{ day_offset: number }>)[0];
  if (!cad || !primeiro) {
    return fail(
      "validation_failed",
      a.t("Desenhe ao menos um passo antes de inscrever leads."),
      422,
      {
        requestId: a.requestId,
      },
    );
  }

  const { data: leads } = await a.supabase
    .from("crm_leads")
    .select("id, stage:crm_stages!inner(slug)")
    .eq("organization_id", a.orgId)
    .eq("demand_campaign_id", id)
    .eq("status", "open")
    .eq("crm_stages.slug", "abordagem")
    .limit(LIMITE);
  const ids = ((leads ?? []) as Array<{ id: string }>).map((l) => l.id);
  if (ids.length === 0) return ok({ inscritos: 0 }, { requestId: a.requestId });

  const { data: jaTem } = await a.supabase
    .from("demand_cadence_enrollments")
    .select("lead_id")
    .eq("organization_id", a.orgId)
    .eq("cadence_id", cad.id as string)
    .eq("status", "ativa")
    .in("lead_id", ids);
  const ativos = new Set(((jaTem ?? []) as Array<{ lead_id: string }>).map((x) => x.lead_id));
  const agora = new Date();
  const vence = new Date(agora.getTime() + primeiro.day_offset * 86_400_000).toISOString();
  const novos = ids
    .filter((l) => !ativos.has(l))
    .map((lead_id) => ({
      organization_id: a.orgId,
      cadence_id: cad.id as string,
      lead_id,
      status: "ativa",
      current_step: 0,
      started_at: agora.toISOString(),
      next_due_at: vence,
      finished_at: null,
    }));
  if (novos.length > 0) {
    const { error } = await a.supabase
      .from("demand_cadence_enrollments")
      .upsert(novos, { onConflict: "cadence_id,lead_id" });
    if (error) {
      return fail("internal_error", a.t("Erro ao inscrever os leads."), 500, {
        requestId: a.requestId,
      });
    }
  }
  return ok({ inscritos: novos.length }, { requestId: a.requestId });
}
