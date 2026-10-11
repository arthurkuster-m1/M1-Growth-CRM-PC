/**
 * POST /api/v1/demand-campaigns/[id]/funnel — cria o funil DESTA campanha (manager+).
 *
 * Sem `template_id`, nasce com as etapas iniciais; com ele, nasce das etapas do modelo. O nome
 * do funil é o da campanha (com sufixo se já existir um igual) e a campanha passa a apontar
 * para ele. Um funil é de uma campanha só: campanha que já tem funil recusa.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { lerFunis } from "@/app/api/v1/pipelines/_funis";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { slugDeNome } from "@/lib/leads/stage-editing";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import {
  COLUNAS_DO_MODELO,
  criarFunilDaCampanhaSchema,
  etapasDoModelo,
  type EtapaDoModelo,
} from "@/lib/marketing/modelos-de-funil";
import { ETAPAS_INICIAIS, posicaoEntre, slugDeFunil } from "@/lib/pipelines/pipeline-editing";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const ETAPAS_PADRAO: EtapaDoModelo[] = ETAPAS_INICIAIS.map((e) => ({
  name: e.name,
  is_won: e.is_won,
  is_lost: e.is_lost,
  win_probability: null,
  expected_duration_hours: null,
  qualification: null,
}));

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const corpo = criarFunilDaCampanhaSchema.safeParse(await req.json().catch(() => ({})));
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
  if (campanha.pipeline_id) {
    return fail("validation_failed", a.t("Esta campanha já tem um funil."), 409, {
      requestId: a.requestId,
    });
  }

  let etapas = ETAPAS_PADRAO;
  if (corpo.data.template_id) {
    const { data: modelo } = await a.supabase
      .from("demand_funnel_templates")
      .select(COLUNAS_DO_MODELO)
      .eq("id", corpo.data.template_id)
      .eq("organization_id", a.orgId)
      .maybeSingle();
    const doModelo = modelo ? etapasDoModelo(modelo.stages) : [];
    if (doModelo.length === 0) {
      return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
    }
    etapas = doModelo;
  }

  const funis = await lerFunis(a.supabase, a.orgId);
  const nomes = new Set(funis.map((f) => f.name.trim().toLowerCase()));
  const base = (campanha.name as string).trim().slice(0, 76);
  let nome = base;
  for (let n = 2; nomes.has(nome.toLowerCase()); n++) nome = `${base} (${n})`;

  const { data: criado, error } = await a.supabase
    .from("crm_pipelines")
    .insert({
      organization_id: a.orgId,
      name: nome,
      slug: slugDeFunil(
        nome,
        funis.map((f) => f.slug),
      ),
      position: posicaoEntre(funis[funis.length - 1]?.position ?? null, null),
      is_default: funis.filter((f) => !f.is_archived).length === 0,
    })
    .select("id")
    .single();
  if (error || !criado) {
    return fail("internal_error", a.t("Erro ao criar o funil."), 500, { requestId: a.requestId });
  }
  const pipelineId = (criado as { id: string }).id;

  const slugs: string[] = [];
  const linhas = etapas.map((e, i) => {
    const slug = slugDeNome(e.name, slugs);
    slugs.push(slug);
    return {
      organization_id: a.orgId,
      pipeline_id: pipelineId,
      name: e.name,
      slug,
      position: (i + 1) * 1000,
      is_won: e.is_won,
      is_lost: e.is_lost,
      win_probability: e.is_won || e.is_lost ? null : e.win_probability,
      expected_duration_hours: e.expected_duration_hours,
      qualification: e.is_won || e.is_lost ? null : e.qualification,
    };
  });
  const { error: erroEtapas } = await a.supabase.from("crm_stages").insert(linhas);
  if (erroEtapas) {
    // Funil sem etapa é quadro morto: desfaz o que acabou de criar.
    await a.supabase
      .from("crm_pipelines")
      .delete()
      .eq("id", pipelineId)
      .eq("organization_id", a.orgId);
    return fail("internal_error", a.t("Erro ao criar as etapas do funil."), 500, {
      requestId: a.requestId,
    });
  }

  const { error: erroCampanha } = await a.supabase
    .from("demand_campaigns")
    .update({ pipeline_id: pipelineId })
    .eq("id", id)
    .eq("organization_id", a.orgId);
  if (erroCampanha) {
    await a.supabase
      .from("crm_pipelines")
      .delete()
      .eq("id", pipelineId)
      .eq("organization_id", a.orgId);
    return fail("internal_error", a.t("Erro ao ligar o funil à campanha."), 500, {
      requestId: a.requestId,
    });
  }

  void audit({
    action: "pipeline.created",
    actorUserId: a.userId,
    organizationId: a.orgId,
    resourceType: "crm_pipeline",
    resourceId: pipelineId,
    requestId: a.requestId,
    metadata: { name: nome, campaign_id: id, template_id: corpo.data.template_id ?? null },
  });

  return ok({ pipeline_id: pipelineId, name: nome }, { requestId: a.requestId, status: 201 });
}
