/** PATCH/DELETE /api/v1/demand-campaigns/[id]/creatives/[creativeId] — edita ou apaga (manager+). */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import {
  COLUNAS_DO_CRIATIVO,
  criativoDaLinha,
  edicaoDeCriativoSchema,
} from "@/lib/marketing/criativos";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; creativeId: string }> };

const uuid = z.string().uuid();

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id, creativeId } = await ctx.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(creativeId).success) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  const corpo = edicaoDeCriativoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { data, error } = await a.supabase
    .from("demand_campaign_creatives")
    .update({
      ...corpo.data,
      // Os campos antigos seguem como a primeira variação.
      ...(corpo.data.headlines ? { headline: corpo.data.headlines[0] ?? "" } : {}),
      ...(corpo.data.bodies ? { caption: corpo.data.bodies[0] ?? "" } : {}),
    })
    .eq("id", creativeId)
    .eq("campaign_id", id)
    .eq("organization_id", a.orgId)
    .select(COLUNAS_DO_CRIATIVO)
    .maybeSingle();
  if (error) {
    return fail("internal_error", a.t("Erro ao salvar o criativo."), 500, {
      requestId: a.requestId,
    });
  }
  if (!data)
    return fail("not_found", a.t("Criativo não encontrado."), 404, { requestId: a.requestId });
  return ok(
    { criativo: criativoDaLinha(data as Record<string, unknown>) },
    { requestId: a.requestId },
  );
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id, creativeId } = await ctx.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(creativeId).success) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  const { error } = await a.supabase
    .from("demand_campaign_creatives")
    .delete()
    .eq("id", creativeId)
    .eq("campaign_id", id)
    .eq("organization_id", a.orgId);
  if (error) {
    return fail("internal_error", a.t("Erro ao apagar o criativo."), 500, {
      requestId: a.requestId,
    });
  }
  return ok({ apagado: true }, { requestId: a.requestId });
}
