/**
 * POST /api/v1/demand-campaigns/[id]/funnel — cria o funil DESTA campanha (manager+).
 *
 * Sem `template_id`, nasce com as etapas iniciais; com ele, nasce das etapas do modelo. O nome
 * do funil é o da campanha (com sufixo se já existir um igual) e a campanha passa a apontar
 * para ele. Um funil é de uma campanha só: campanha que já tem funil recusa.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { lerDependencias, lerFunis } from "@/app/api/v1/pipelines/_funis";
import { fail, ok } from "@/lib/api/wrappers";
import { logger } from "@/lib/logger";
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
import { modeloFixoDoId } from "@/lib/marketing/modelos-de-funil-fixos";
import {
  ETAPAS_INICIAIS,
  podeExcluirDeVez,
  posicaoEntre,
  slugDeFunil,
  validarArquivamento,
} from "@/lib/pipelines/pipeline-editing";

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
  const funilAntigoId = (campanha.pipeline_id as string | null) ?? null;
  if (funilAntigoId && !corpo.data.substituir) {
    return fail("validation_failed", a.t("Esta campanha já tem um funil."), 409, {
      requestId: a.requestId,
    });
  }

  let etapas = ETAPAS_PADRAO;
  const fixo = modeloFixoDoId(corpo.data.template_id);
  if (corpo.data.template_id?.startsWith("fixo:")) {
    // Modelo fixo (já vem pronto, igual em toda empresa): não está no banco.
    if (!fixo) {
      return fail("not_found", a.t("Modelo não encontrado."), 404, { requestId: a.requestId });
    }
    etapas = fixo.stages;
  } else if (corpo.data.template_id) {
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

  let funis = await lerFunis(a.supabase, a.orgId);
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
    logger.error("[demand-campaigns.funnel] funil não criado", { campaign_id: id, erro: error?.message });
    return fail("funnel_stages_failed", `${a.t("Erro ao criar o funil")}: ${error?.message ?? ""}`, 500, {
      requestId: a.requestId,
    });
  }
  const pipelineId = (criado as { id: string }).id;

  // Alguns bancos criam etapas sozinhos ao nascer um funil (ex.: "Desqualificado"). O funil é novo
  // e é nosso: limpa o que nasceu junto para o modelo ocupar os slugs sem colidir.
  await a.supabase
    .from("crm_stages")
    .delete()
    .eq("pipeline_id", pipelineId)
    .eq("organization_id", a.orgId);

  const slugs: string[] = [];
  const papeisNaoGravados: string[] = [];
  const linhas = etapas.map((e, i) => {
    // O slug do modelo (`agendado`, `reuniao-realizada`) liga a etapa ao compromisso; sem ele, do nome.
    const slug = e.slug && !slugs.includes(e.slug) ? e.slug : slugDeNome(e.name, slugs);
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
  let { error: erroEtapas } = await a.supabase.from("crm_stages").insert(linhas);
  if (erroEtapas) {
    // O papel de qualificação (MQL / desqualificado) dispara uma regra da Meta no banco; se ESSA
    // parte falhar, o funil não pode deixar de nascer por causa dela. Tenta de novo sem o papel e
    // aplica-o etapa por etapa — o que não pegar fica sem o papel, e o aviso diz quais.
    logger.warn("[demand-campaigns.funnel] etapas com qualificação falharam; tentando sem", {
      campaign_id: id,
      erro: erroEtapas.message,
      codigo: (erroEtapas as { code?: string }).code,
    });
    const { data: inseridas, error: erroSemPapel } = await a.supabase
      .from("crm_stages")
      .insert(linhas.map((l) => ({ ...l, qualification: null })))
      .select("id, slug");
    if (!erroSemPapel) {
      erroEtapas = null;
      for (const l of linhas) {
        if (!l.qualification) continue;
        const criada = (inseridas ?? []).find((x) => x.slug === l.slug);
        if (!criada) continue;
        const { error: erroPapel } = await a.supabase
          .from("crm_stages")
          .update({ qualification: l.qualification })
          .eq("id", criada.id as string)
          .eq("organization_id", a.orgId);
        if (erroPapel) {
          logger.warn("[demand-campaigns.funnel] papel de qualificação não gravado", {
            campaign_id: id,
            etapa: l.name,
            erro: erroPapel.message,
          });
          papeisNaoGravados.push(l.name);
        }
      }
    } else {
      erroEtapas = erroSemPapel;
    }
  }
  if (erroEtapas) {
    logger.error("[demand-campaigns.funnel] etapas não criadas", {
      campaign_id: id,
      erro: erroEtapas.message,
      codigo: (erroEtapas as { code?: string }).code,
    });
    // Funil sem etapa é quadro morto: desfaz o que acabou de criar.
    await a.supabase
      .from("crm_pipelines")
      .delete()
      .eq("id", pipelineId)
      .eq("organization_id", a.orgId);
    // Código próprio (não `internal_error`): a tela mostra a frase, com o motivo do banco, em vez
    // do "erro interno" genérico — quem está montando o funil precisa saber o que recusou.
    return fail(
      "funnel_stages_failed",
      `${a.t("Erro ao criar as etapas do funil")}: ${erroEtapas.message}`,
      500,
      { requestId: a.requestId },
    );
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
    logger.error("[demand-campaigns.funnel] campanha não ligada ao funil", {
      campaign_id: id,
      erro: erroCampanha.message,
    });
    return fail(
      "funnel_stages_failed",
      `${a.t("Erro ao ligar o funil à campanha")}: ${erroCampanha.message}`,
      500,
      { requestId: a.requestId },
    );
  }

  // RECOMEÇAR: o que dependia do funil antigo passa para o novo, e o antigo sai de cena.
  let funilAntigo: "excluido" | "arquivado" | "mantido" | null = null;
  let motivoDoAntigo: string | undefined;
  let nomeFinal = nome;
  if (funilAntigoId) {
    // Os formulários da campanha (fonte de webhook) mandam o lead para o funil novo — sem isso o
    // lead continuaria entrando no antigo.
    const primeiraEtapa = await a.supabase
      .from("crm_stages")
      .select("id")
      .eq("organization_id", a.orgId)
      .eq("pipeline_id", pipelineId)
      .eq("is_archived", false)
      .eq("is_won", false)
      .eq("is_lost", false)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    await a.supabase
      .from("webhook_sources")
      .update({
        default_pipeline_id: pipelineId,
        default_stage_id: (primeiraEtapa.data?.id as string | undefined) ?? null,
      })
      .eq("organization_id", a.orgId)
      .eq("default_pipeline_id", funilAntigoId);

    funis = await lerFunis(a.supabase, a.orgId);
    const deps = await lerDependencias(a.supabase, a.orgId, funilAntigoId);
    const antigo = funis.find((f) => f.id === funilAntigoId);
    const veredito = podeExcluirDeVez(funis, funilAntigoId, deps);
    if (veredito.ok) {
      const { error: erroExcluir } = await a.supabase
        .from("crm_pipelines")
        .delete()
        .eq("id", funilAntigoId)
        .eq("organization_id", a.orgId);
      funilAntigo = erroExcluir ? "mantido" : "excluido";
      if (erroExcluir) motivoDoAntigo = erroExcluir.message;
    } else {
      const arquivavel = validarArquivamento(funis, funilAntigoId, deps);
      if (arquivavel.ok) {
        // Nome livre para o novo funil: o antigo vira "(antigo)" e o novo fica com o nome limpo.
        const ocupados = new Set(funis.map((f) => f.name.trim().toLowerCase()));
        let nomeAntigo = `${(antigo?.name ?? base).slice(0, 70)} (antigo)`;
        for (let n = 2; ocupados.has(nomeAntigo.toLowerCase()); n++) {
          nomeAntigo = `${(antigo?.name ?? base).slice(0, 66)} (antigo ${n})`;
        }
        const { error: erroArquivar } = await a.supabase
          .from("crm_pipelines")
          .update({ is_archived: true, name: nomeAntigo })
          .eq("id", funilAntigoId)
          .eq("organization_id", a.orgId);
        funilAntigo = erroArquivar ? "mantido" : "arquivado";
        if (erroArquivar) motivoDoAntigo = erroArquivar.message;
      } else {
        funilAntigo = "mantido";
        motivoDoAntigo = arquivavel.erro;
      }
    }
    // O antigo saiu da frente: o novo pode ficar com o nome limpo da campanha.
    if (funilAntigo !== "mantido" && nome !== base) {
      const { error: erroNome } = await a.supabase
        .from("crm_pipelines")
        .update({ name: base })
        .eq("id", pipelineId)
        .eq("organization_id", a.orgId);
      if (!erroNome) nomeFinal = base;
    }
  }

  void audit({
    action: "pipeline.created",
    actorUserId: a.userId,
    organizationId: a.orgId,
    resourceType: "crm_pipeline",
    resourceId: pipelineId,
    requestId: a.requestId,
    metadata: {
      name: nomeFinal,
      campaign_id: id,
      template_id: corpo.data.template_id ?? null,
      substituiu_funil: funilAntigoId,
      funil_antigo: funilAntigo,
    },
  });

  return ok(
    {
      pipeline_id: pipelineId,
      name: nomeFinal,
      funil_antigo: funilAntigo,
      ...(papeisNaoGravados.length > 0 ? { etapas_sem_papel_de_qualificacao: papeisNaoGravados } : {}),
      ...(motivoDoAntigo ? { motivo_do_funil_antigo: motivoDoAntigo } : {}),
    },
    { requestId: a.requestId, status: 201 },
  );
}
