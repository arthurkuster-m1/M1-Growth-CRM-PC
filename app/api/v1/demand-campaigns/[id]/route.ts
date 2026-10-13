/** PATCH/DELETE /api/v1/demand-campaigns/[id] — edita ou apaga uma campanha (manager+). */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  COLUNAS_DA_CAMPANHA,
  campanhaDaLinha,
  edicaoDeCampanhaSchema,
} from "@/lib/marketing/campanhas";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const corpo = edicaoDeCampanhaSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { data, error } = await a.supabase
    .from("demand_campaigns")
    .update(corpo.data)
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .select(COLUNAS_DA_CAMPANHA)
    .maybeSingle();
  if (error) {
    // 23514 = o fim antes do início chegando só por uma das datas
    const codigo = (error as { code?: string }).code;
    return fail(
      codigo === "23514" || codigo === "23503" ? "validation_failed" : "internal_error",
      codigo === "23514" ? a.t("O fim vem depois do início.") : a.t("Erro ao salvar a campanha."),
      codigo === "23514" || codigo === "23503" ? 422 : 500,
      { requestId: a.requestId },
    );
  }
  if (!data) return campanhaNaoEncontrada(a.t, a.requestId);
  await audit({
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: "demand_campaign.updated",
    resourceType: "demand_campaigns",
    resourceId: id,
    requestId: a.requestId,
    metadata: { campos: Object.keys(corpo.data) },
  });
  return ok(
    { campanha: campanhaDaLinha(data as Record<string, unknown>) },
    { requestId: a.requestId },
  );
}

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const destino = req.nextUrl.searchParams.get("destino");

  // O funil da campanha vai junto; os leads dele passam para `destino` (obrigatório se houver).
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fn_demand_campaign_apagar", {
    p_org: a.orgId,
    p_campaigns: [id],
    p_destino: destino && z.string().uuid().safeParse(destino).success ? destino : null,
  });
  if (error) {
    if (
      error.message.includes("destino_obrigatorio") ||
      error.message.includes("destino_invalido")
    ) {
      return fail("validation_failed", a.t("Escolha para qual funil os leads vão passar."), 422, {
        requestId: a.requestId,
      });
    }
    return fail("internal_error", a.t("Erro ao apagar a campanha."), 500, {
      requestId: a.requestId,
    });
  }
  if (!(data as { campanhas_apagadas?: number } | null)?.campanhas_apagadas) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  await audit({
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: "demand_campaign.deleted",
    resourceType: "demand_campaigns",
    resourceId: id,
    requestId: a.requestId,
  });
  return ok({ deleted: true }, { requestId: a.requestId });
}
