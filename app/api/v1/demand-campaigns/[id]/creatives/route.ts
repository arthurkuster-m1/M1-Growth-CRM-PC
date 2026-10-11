/**
 * GET  /api/v1/demand-campaigns/[id]/creatives — os criativos da campanha (a empresa lê).
 * POST /api/v1/demand-campaigns/[id]/creatives — novo criativo (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import {
  COLUNAS_DO_CRIATIVO,
  criativoDaLinha,
  novoCriativoSchema,
} from "@/lib/marketing/criativos";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const idValido = (id: string) => z.string().uuid().safeParse(id).success;

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!idValido(id)) return campanhaNaoEncontrada(a.t, a.requestId);
  const { data, error } = await a.supabase
    .from("demand_campaign_creatives")
    .select(COLUNAS_DO_CRIATIVO)
    .eq("organization_id", a.orgId)
    .eq("campaign_id", id)
    .order("position", { ascending: true })
    .limit(500);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar os criativos."), 500, {
      requestId: a.requestId,
    });
  }
  return ok(
    { criativos: (data ?? []).map((l) => criativoDaLinha(l as Record<string, unknown>)) },
    { requestId: a.requestId },
  );
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!idValido(id)) return campanhaNaoEncontrada(a.t, a.requestId);
  const corpo = novoCriativoSchema.safeParse(await req.json().catch(() => null));
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
  const { data, error } = await a.supabase
    .from("demand_campaign_creatives")
    .insert({ ...corpo.data, organization_id: a.orgId, campaign_id: id, created_by: a.userId })
    .select(COLUNAS_DO_CRIATIVO)
    .single();
  if (error || !data) {
    return fail("internal_error", a.t("Erro ao salvar o criativo."), 500, {
      requestId: a.requestId,
    });
  }
  return ok(
    { criativo: criativoDaLinha(data as Record<string, unknown>) },
    { requestId: a.requestId, status: 201 },
  );
}
