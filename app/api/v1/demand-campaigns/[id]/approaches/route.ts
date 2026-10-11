/**
 * GET  /api/v1/demand-campaigns/[id]/approaches — as abordagens da campanha (a empresa lê).
 * POST /api/v1/demand-campaigns/[id]/approaches — nova abordagem (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  COLUNAS_DA_ABORDAGEM,
  abordagemDaLinha,
  novaAbordagemSchema,
} from "@/lib/marketing/abordagens";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const idValido = (id: string) => z.string().uuid().safeParse(id).success;

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!idValido(id)) return campanhaNaoEncontrada(a.t, a.requestId);
  const { data, error } = await a.supabase
    .from("demand_campaign_approaches")
    .select(COLUNAS_DA_ABORDAGEM)
    .eq("organization_id", a.orgId)
    .eq("campaign_id", id)
    .order("position", { ascending: true })
    .limit(500);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar as abordagens."), 500, {
      requestId: a.requestId,
    });
  }
  return ok(
    { abordagens: (data ?? []).map((l) => abordagemDaLinha(l as Record<string, unknown>)) },
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
  const corpo = novaAbordagemSchema.safeParse(await req.json().catch(() => null));
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
    .from("demand_campaign_approaches")
    .insert({ ...corpo.data, organization_id: a.orgId, campaign_id: id, created_by: a.userId })
    .select(COLUNAS_DA_ABORDAGEM)
    .single();
  if (error || !data) {
    return fail("internal_error", a.t("Erro ao salvar a abordagem."), 500, {
      requestId: a.requestId,
    });
  }
  return ok(
    { abordagem: abordagemDaLinha(data as Record<string, unknown>) },
    { requestId: a.requestId, status: 201 },
  );
}
