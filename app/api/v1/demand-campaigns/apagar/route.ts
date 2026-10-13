/**
 * POST /api/v1/demand-campaigns/apagar { ids, destino? } — apaga campanhas e os funis delas.
 *
 * Os leads que estavam nos funis apagados passam para o funil `destino` (obrigatório quando há
 * lead). Funil padrão ou usado por outra campanha não é apagado. Só gerente.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  destino: z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fn_demand_campaign_apagar", {
    p_org: a.orgId,
    p_campaigns: corpo.data.ids,
    p_destino: corpo.data.destino ?? null,
  });
  if (error) {
    if (error.message.includes("destino_obrigatorio")) {
      return fail("validation_failed", a.t("Escolha para qual funil os leads vão passar."), 422, {
        requestId: a.requestId,
      });
    }
    if (error.message.includes("destino_invalido")) {
      return fail(
        "validation_failed",
        a.t("O funil de destino não pode ser o que está sendo apagado."),
        422,
        { requestId: a.requestId },
      );
    }
    return fail("internal_error", a.t("Erro ao apagar a campanha."), 500, {
      requestId: a.requestId,
    });
  }
  for (const id of corpo.data.ids) {
    await audit({
      organizationId: a.orgId,
      actorUserId: a.userId,
      action: "demand_campaign.deleted",
      resourceType: "demand_campaigns",
      resourceId: id,
      requestId: a.requestId,
      metadata: { destino: corpo.data.destino ?? null },
    });
  }
  return ok(data as Record<string, unknown>, { requestId: a.requestId });
}
