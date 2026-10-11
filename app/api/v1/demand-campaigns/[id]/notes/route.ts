/**
 * GET  /api/v1/demand-campaigns/[id]/notes — o diário de bordo (a agência vê tudo; o cliente, só
 *      as otimizações — quem filtra é a RLS).
 * POST /api/v1/demand-campaigns/[id]/notes — nova nota (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { COLUNAS_DA_NOTA, novaNotaSchema } from "@/lib/marketing/campanhas";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const { data, error } = await a.supabase
    .from("demand_campaign_notes")
    .select(COLUNAS_DA_NOTA)
    .eq("organization_id", a.orgId)
    .eq("campaign_id", id)
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar o diário."), 500, {
      requestId: a.requestId,
    });
  }
  return ok({ notas: data ?? [] }, { requestId: a.requestId });
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const corpo = novaNotaSchema.safeParse(await req.json().catch(() => null));
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
    .from("demand_campaign_notes")
    .insert({
      organization_id: a.orgId,
      campaign_id: id,
      author_id: a.userId,
      kind: corpo.data.kind,
      body: corpo.data.body,
      ...(corpo.data.note_date ? { note_date: corpo.data.note_date } : {}),
    })
    .select(COLUNAS_DA_NOTA)
    .single();
  if (error || !data) {
    return fail("internal_error", a.t("Erro ao salvar a nota."), 500, { requestId: a.requestId });
  }
  return ok({ nota: data }, { requestId: a.requestId, status: 201 });
}
