/**
 * POST /api/v1/demand-campaigns/[id]/creatives/[creativeId]/duplicate — duplica o criativo com
 * as imagens e os textos prontos (nome "… (cópia)"); sem anúncio do Meta e sem métricas (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import { COLUNAS_DO_CRIATIVO, criativoDaLinha } from "@/lib/marketing/criativos";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; creativeId: string }> };

const uuid = z.string().uuid();

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id, creativeId } = await ctx.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(creativeId).success) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  const { data: origem } = await a.supabase
    .from("demand_campaign_creatives")
    .select(COLUNAS_DO_CRIATIVO)
    .eq("id", creativeId)
    .eq("campaign_id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!origem) {
    return fail("not_found", a.t("Criativo não encontrado."), 404, { requestId: a.requestId });
  }
  const o = criativoDaLinha(origem as Record<string, unknown>);
  const { data, error } = await a.supabase
    .from("demand_campaign_creatives")
    .insert({
      organization_id: a.orgId,
      campaign_id: id,
      created_by: a.userId,
      name: `${o.name} (${a.t("cópia")})`.slice(0, 160),
      status: o.status,
      format: o.format,
      headline: o.headline,
      caption: o.caption,
      headlines: o.headlines,
      bodies: o.bodies,
      descriptions: o.descriptions,
      images: o.images,
      media_url: o.media_url,
      thumbnail_url: o.thumbnail_url,
      link_url: o.link_url,
      notes: o.notes,
    })
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
