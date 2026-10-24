/**
 * POST /api/v1/cadence-templates — salva a cadência de uma campanha como modelo da empresa
 * (manager+). Os modelos aparecem no GET da cadência de qualquer campanha.
 */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { novoModeloSchema } from "@/lib/cadencia/cadencia";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const corpo = novoModeloSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { data: cad } = await a.supabase
    .from("demand_cadences")
    .select("id")
    .eq("organization_id", a.orgId)
    .eq("campaign_id", corpo.data.campaign_id)
    .maybeSingle();
  if (!cad) return campanhaNaoEncontrada(a.t, a.requestId);
  const { data: passos } = await a.supabase
    .from("demand_cadence_steps")
    .select("day_offset, medium, note, position")
    .eq("organization_id", a.orgId)
    .eq("cadence_id", cad.id as string)
    .order("position", { ascending: true })
    .limit(100);
  if ((passos ?? []).length === 0) {
    return fail(
      "validation_failed",
      a.t("Desenhe ao menos um passo antes de salvar o modelo."),
      422,
      {
        requestId: a.requestId,
      },
    );
  }
  const { data: modelo, error } = await a.supabase
    .from("demand_cadences")
    .insert({ organization_id: a.orgId, name: corpo.data.name, created_by: a.userId })
    .select("id")
    .single();
  if (error || !modelo) {
    return fail("internal_error", a.t("Erro ao salvar o modelo."), 500, { requestId: a.requestId });
  }
  const { error: erroPassos } = await a.supabase.from("demand_cadence_steps").insert(
    (passos ?? []).map((p, i) => ({
      organization_id: a.orgId,
      cadence_id: modelo.id as string,
      position: i,
      day_offset: (p as { day_offset: number }).day_offset,
      medium: (p as { medium: string }).medium,
      note: (p as { note: string }).note,
      approach_id: null,
    })),
  );
  if (erroPassos) {
    await a.supabase
      .from("demand_cadences")
      .delete()
      .eq("id", modelo.id as string);
    return fail("internal_error", a.t("Erro ao salvar o modelo."), 500, { requestId: a.requestId });
  }
  return ok({ id: modelo.id as string }, { requestId: a.requestId, status: 201 });
}
