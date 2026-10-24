/**
 * POST /api/v1/demand-campaigns/[id]/cadence/apply-template — copia os passos de um modelo da
 * empresa para a cadência da campanha (substitui os passos; o destino do fim é da campanha e fica).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const corpoSchema = z.object({ template_id: z.string().uuid() });

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { data: campanha } = await a.supabase
    .from("demand_campaigns")
    .select("id")
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!campanha) return campanhaNaoEncontrada(a.t, a.requestId);
  const { data: modelo } = await a.supabase
    .from("demand_cadences")
    .select("id")
    .eq("id", corpo.data.template_id)
    .eq("organization_id", a.orgId)
    .is("campaign_id", null)
    .maybeSingle();
  if (!modelo) {
    return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
  }
  const { data: passos } = await a.supabase
    .from("demand_cadence_steps")
    .select("day_offset, medium, note, position")
    .eq("organization_id", a.orgId)
    .eq("cadence_id", modelo.id as string)
    .order("position", { ascending: true })
    .limit(100);

  // A cadência da campanha: cria vazia se ainda não existe.
  let { data: cad } = await a.supabase
    .from("demand_cadences")
    .select("id")
    .eq("organization_id", a.orgId)
    .eq("campaign_id", id)
    .maybeSingle();
  if (!cad) {
    const { data: criada, error } = await a.supabase
      .from("demand_cadences")
      .insert({ organization_id: a.orgId, campaign_id: id, created_by: a.userId })
      .select("id")
      .single();
    if (error || !criada) {
      return fail("internal_error", a.t("Erro ao aplicar o modelo."), 500, {
        requestId: a.requestId,
      });
    }
    cad = criada;
  }
  const cadenciaId = cad!.id as string;
  const { data: antigos } = await a.supabase
    .from("demand_cadence_steps")
    .select("id")
    .eq("organization_id", a.orgId)
    .eq("cadence_id", cadenciaId);
  // A abordagem é da campanha de origem, então a cópia sai sem ela: a pessoa escolhe de novo.
  const novos = (passos ?? []).map((p, i) => ({
    organization_id: a.orgId,
    cadence_id: cadenciaId,
    position: i,
    day_offset: (p as { day_offset: number }).day_offset,
    medium: (p as { medium: string }).medium,
    note: (p as { note: string }).note,
    approach_id: null,
  }));
  if (novos.length > 0) {
    const { error } = await a.supabase.from("demand_cadence_steps").insert(novos);
    if (error) {
      return fail("internal_error", a.t("Erro ao aplicar o modelo."), 500, {
        requestId: a.requestId,
      });
    }
  }
  const ids = (antigos ?? []).map((x) => (x as { id: string }).id);
  if (ids.length > 0) {
    await a.supabase
      .from("demand_cadence_steps")
      .delete()
      .eq("organization_id", a.orgId)
      .in("id", ids);
  }
  return ok({ passos: novos.length }, { requestId: a.requestId });
}
