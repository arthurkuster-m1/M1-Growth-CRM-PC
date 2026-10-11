/**
 * GET /api/v1/demand-campaigns/[id]/entrada — como os leads chegam a esta campanha: as fontes de
 * formulário da empresa e quais já alimentam a campanha (manager+).
 * PUT /api/v1/demand-campaigns/[id]/entrada — liga ou desliga uma fonte de formulário da campanha.
 *
 * Fonte ligada: o lead que ela capta nasce no funil da campanha e carrega a origem (campanha, e
 * LP/criativo quando a UTM ou a página permitem casar).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const uuid = z.string().uuid();
const corpoSchema = z.object({ source_id: z.string().uuid(), ligar: z.boolean() });

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("manager", false);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const { data, error } = await a.supabase
    .from("webhook_sources")
    .select("id, name, is_active, demand_campaign_id, last_received_at")
    .eq("organization_id", a.orgId)
    .order("name", { ascending: true })
    .limit(200);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar as fontes de formulário."), 500, {
      requestId: a.requestId,
    });
  }
  return ok(
    {
      fontes: (data ?? []).map((f) => ({
        id: f.id as string,
        name: f.name as string,
        ativa: f.is_active === true,
        desta_campanha: f.demand_campaign_id === id,
        de_outra_campanha: f.demand_campaign_id !== null && f.demand_campaign_id !== id,
        ultimo_recebimento: (f.last_received_at as string | null) ?? null,
      })),
    },
    { requestId: a.requestId },
  );
}

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !corpo.success) {
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
    .from("webhook_sources")
    .update({ demand_campaign_id: corpo.data.ligar ? id : null })
    .eq("id", corpo.data.source_id)
    .eq("organization_id", a.orgId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return fail("not_found", a.t("Fonte de formulário não encontrada."), 404, {
      requestId: a.requestId,
    });
  }
  return ok({ ok: true }, { requestId: a.requestId });
}
