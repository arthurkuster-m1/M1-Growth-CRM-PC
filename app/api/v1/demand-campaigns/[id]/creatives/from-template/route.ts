/**
 * POST /api/v1/demand-campaigns/[id]/creatives/from-template — cria criativos PLANEJADOS a partir
 * de modelos: a tag do modelo é trocada pelo valor (a cidade) no nome e em todos os textos. O
 * criativo nasce com o nome que vai para o Meta; a importação do Meta o completa depois (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import { COLUNAS_DO_CRIATIVO, criativoDaLinha } from "@/lib/marketing/criativos";
import {
  COLUNAS_DO_MODELO,
  criarDoModeloSchema,
  criativoDoModelo,
  modeloDaLinha,
} from "@/lib/marketing/modelos-de-criativo";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const corpo = criarDoModeloSchema.safeParse(await req.json().catch(() => null));
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

  const { data: modelos } = await a.supabase
    .from("demand_creative_templates")
    .select(COLUNAS_DO_MODELO)
    .eq("organization_id", a.orgId)
    .in("id", corpo.data.template_ids);
  const lista = (modelos ?? []).map((l) => modeloDaLinha(l as unknown as Record<string, unknown>));
  if (lista.length === 0) {
    return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
  }
  // Na ordem em que a pessoa escolheu.
  lista.sort(
    (x, y) => corpo.data.template_ids.indexOf(x.id) - corpo.data.template_ids.indexOf(y.id),
  );

  const agora = Date.now();
  const linhas = lista.map((m, i) => ({
    ...criativoDoModelo(m, corpo.data.valor),
    organization_id: a.orgId,
    campaign_id: id,
    created_by: a.userId,
    position: agora + i,
  }));
  const { data, error } = await a.supabase
    .from("demand_campaign_creatives")
    .insert(linhas)
    .select(COLUNAS_DO_CRIATIVO);
  if (error || !data) {
    return fail("internal_error", a.t("Erro ao criar os criativos."), 500, {
      requestId: a.requestId,
    });
  }
  return ok(
    { criativos: data.map((l) => criativoDaLinha(l as unknown as Record<string, unknown>)) },
    { requestId: a.requestId, status: 201 },
  );
}
