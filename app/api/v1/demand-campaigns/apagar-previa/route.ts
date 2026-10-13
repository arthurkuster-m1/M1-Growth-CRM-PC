/**
 * GET /api/v1/demand-campaigns/apagar-previa?ids=a,b — o que apagar estas campanhas leva junto.
 *
 * Funil só existe atrelado a uma campanha: apagar a campanha apaga o funil dela. Esta rota diz
 * quantos leads estão nesses funis (e precisam de um funil de destino) e quais funis servem de
 * destino (os que continuam existindo).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const idsSchema = z.array(z.string().uuid()).min(1).max(100);

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const ids = idsSchema.safeParse(
    (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean),
  );
  if (!ids.success) {
    return fail("validation_failed", a.t("Parâmetros inválidos."), 422, { requestId: a.requestId });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fn_demand_campaign_apagar_previa", {
    p_org: a.orgId,
    p_campaigns: ids.data,
  });
  if (error) {
    return fail("internal_error", a.t("Erro ao apagar a campanha."), 500, {
      requestId: a.requestId,
    });
  }
  const afetados = (data ?? []) as Array<{ pipeline_id: string; leads: number }>;
  const leads = afetados.reduce((s, r) => s + (Number(r.leads) || 0), 0);

  const saem = new Set(afetados.map((r) => r.pipeline_id));
  const { data: funis } = await a.supabase
    .from("crm_pipelines")
    .select("id, name, is_default")
    .eq("organization_id", a.orgId)
    .eq("is_archived", false)
    .order("position", { ascending: true });
  const destinos = ((funis ?? []) as Array<{ id: string; name: string; is_default: boolean }>)
    .filter((f) => !saem.has(f.id))
    .map((f) => ({ id: f.id, name: f.name }));

  return ok({ funis_apagados: afetados.length, leads, destinos }, { requestId: a.requestId });
}
