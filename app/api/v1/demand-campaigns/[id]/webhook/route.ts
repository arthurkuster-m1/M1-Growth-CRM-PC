/**
 * POST /api/v1/demand-campaigns/[id]/webhook — cria, de dentro da campanha, a fonte de leads
 * (o webhook de captação que aparece em Conexões) já ligada a ela: o lead que chegar por esse
 * endereço nasce na primeira etapa do funil da campanha e carrega a origem.
 *
 * É o MESMO objeto de Conexões › Webhooks (`webhook_sources`): criar aqui ou lá dá na mesma, e
 * a gestão de todos continua em Conexões. Pede o funil da campanha (o destino do lead).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { respostaDeRecusa } from "@/lib/api/recusa";
import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import { primeiraEtapaDoFunil } from "@/lib/marketing/origem-da-campanha-servidor";
import { criarEntradaAutomatica } from "@/lib/operacao/entradas-automaticas";
import { createAdminClient } from "@/lib/supabase/admin";
import { basePublicaDaInstalacao } from "@/lib/webhooks/url-publica";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const corpoSchema = z.object({ name: z.string().trim().min(1).max(120).optional() });

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const corpo = corpoSchema.safeParse(await req.json().catch(() => ({})));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }

  const { data: campanha } = await a.supabase
    .from("demand_campaigns")
    .select("id, name, pipeline_id")
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!campanha) return campanhaNaoEncontrada(a.t, a.requestId);
  if (!campanha.pipeline_id) {
    return fail(
      "validation_failed",
      a.t(
        "Crie o funil da campanha primeiro (aba Funil de conversão): é nele que os leads nascem.",
      ),
      422,
      { requestId: a.requestId },
    );
  }
  const etapa = await primeiraEtapaDoFunil(
    a.supabase as never,
    a.orgId,
    campanha.pipeline_id as string,
  );
  if (!etapa) {
    return fail("validation_failed", a.t("O funil da campanha não tem etapa aberta."), 422, {
      requestId: a.requestId,
    });
  }

  const nome = (corpo.data.name ?? `${campanha.name as string} — webhook`).slice(0, 120);
  try {
    const criada = (await criarEntradaAutomatica(
      {
        supabase: a.supabase,
        organizationId: a.orgId,
        actor: { type: "user", id: a.userId, role: "manager" },
        requestId: a.requestId,
      },
      {
        name: nome,
        default_pipeline_id: campanha.pipeline_id as string,
        default_stage_id: etapa,
        redirect_to: null,
        field_map: {},
        secret_encrypted: null,
      },
    )) as unknown as { id?: string; path_token?: string } | null;

    const fonteId = criada?.id;
    if (!fonteId) {
      return fail("internal_error", a.t("Erro ao criar o webhook."), 500, {
        requestId: a.requestId,
      });
    }
    await createAdminClient()
      .from("webhook_sources")
      .update({ demand_campaign_id: id })
      .eq("id", fonteId)
      .eq("organization_id", a.orgId);
    const { data: fonte } = await a.supabase
      .from("webhook_sources")
      .select("id, name, path_token")
      .eq("id", fonteId)
      .eq("organization_id", a.orgId)
      .maybeSingle();
    const base = basePublicaDaInstalacao(req);
    return ok(
      {
        id: fonteId,
        name: (fonte?.name as string | undefined) ?? nome,
        url: `${base}/api/v1/webhooks/in/${(fonte?.path_token as string | undefined) ?? criada?.path_token ?? ""}`,
      },
      { requestId: a.requestId, status: 201 },
    );
  } catch (err) {
    return respostaDeRecusa(err, a.requestId);
  }
}
