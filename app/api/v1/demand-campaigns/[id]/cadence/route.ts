/**
 * GET /api/v1/demand-campaigns/[id]/cadence — a cadência da campanha, as etapas do funil dela
 *   (para escolher o destino do fim) e os modelos da empresa (a empresa lê).
 * PUT /api/v1/demand-campaigns/[id]/cadence — grava o desenho inteiro: passos e destino (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import {
  cadenciaSchema,
  ordenarPassos,
  type CadenciaDaCampanha,
  type ModeloDeCadencia,
} from "@/lib/cadencia/cadencia";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const idValido = (id: string) => z.string().uuid().safeParse(id).success;

type Cliente = Extract<Awaited<ReturnType<typeof autorizarCampanhas>>, { ok: true }>["supabase"];

async function carregarPassos(supabase: Cliente, orgId: string, cadenciaId: string) {
  const { data } = await supabase
    .from("demand_cadence_steps")
    .select("id, position, day_offset, medium, approach_id, note")
    .eq("organization_id", orgId)
    .eq("cadence_id", cadenciaId)
    .order("position", { ascending: true })
    .limit(100);
  return (data ?? []) as Array<{
    id: string;
    position: number;
    day_offset: number;
    medium: CadenciaDaCampanha["steps"][number]["medium"];
    approach_id: string | null;
    note: string;
  }>;
}

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!idValido(id)) return campanhaNaoEncontrada(a.t, a.requestId);

  const { data: campanha } = await a.supabase
    .from("demand_campaigns")
    .select("id, pipeline_id")
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!campanha) return campanhaNaoEncontrada(a.t, a.requestId);

  const { data: cad } = await a.supabase
    .from("demand_cadences")
    .select("id, end_action, end_stage_id")
    .eq("organization_id", a.orgId)
    .eq("campaign_id", id)
    .maybeSingle();
  const passos = cad ? await carregarPassos(a.supabase, a.orgId, cad.id as string) : [];
  let ativos = 0;
  const contagem = new Map<number, number>();
  if (cad) {
    const { data: inscritos } = await a.supabase
      .from("demand_cadence_enrollments")
      .select("current_step")
      .eq("organization_id", a.orgId)
      .eq("cadence_id", cad.id as string)
      .eq("status", "ativa")
      .limit(10000);
    for (const i of (inscritos ?? []) as Array<{ current_step: number }>) {
      ativos += 1;
      contagem.set(i.current_step, (contagem.get(i.current_step) ?? 0) + 1);
    }
  }

  const pipelineId = (campanha as { pipeline_id: string | null }).pipeline_id;
  const { data: etapas } = pipelineId
    ? await a.supabase
        .from("crm_stages")
        .select("id, name, position, is_won, is_lost")
        .eq("organization_id", a.orgId)
        .eq("pipeline_id", pipelineId)
        .eq("is_archived", false)
        .order("position", { ascending: true })
        .limit(100)
    : { data: [] };

  const { data: modelosBrutos } = await a.supabase
    .from("demand_cadences")
    .select("id, name")
    .eq("organization_id", a.orgId)
    .is("campaign_id", null)
    .order("name", { ascending: true })
    .limit(100);
  const modelos: ModeloDeCadencia[] = [];
  for (const m of (modelosBrutos ?? []) as Array<{ id: string; name: string }>) {
    const { count } = await a.supabase
      .from("demand_cadence_steps")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", a.orgId)
      .eq("cadence_id", m.id);
    modelos.push({ id: m.id, name: m.name, passos: count ?? 0 });
  }

  const cadencia: CadenciaDaCampanha = {
    id: (cad?.id as string | undefined) ?? null,
    end_action: (cad?.end_action as CadenciaDaCampanha["end_action"] | undefined) ?? "perdido",
    end_stage_id: (cad?.end_stage_id as string | null | undefined) ?? null,
    steps: passos.map((p) => ({
      id: p.id,
      day_offset: p.day_offset,
      medium: p.medium,
      approach_id: p.approach_id,
      note: p.note,
    })),
    ativos,
    por_passo: passos.map((_, i) => contagem.get(i) ?? 0),
    aguardando: [...contagem.entries()]
      .filter(([passo]) => passo >= passos.length)
      .reduce((soma, [, n]) => soma + n, 0),
    funil_id: (campanha as { pipeline_id: string | null }).pipeline_id,
  };
  return ok(
    {
      cadencia,
      etapas: (etapas ?? []).map((e) => ({
        id: (e as { id: string }).id,
        name: (e as { name: string }).name,
        is_won: Boolean((e as { is_won: boolean }).is_won),
        is_lost: Boolean((e as { is_lost: boolean }).is_lost),
      })),
      modelos,
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
  if (!idValido(id)) return campanhaNaoEncontrada(a.t, a.requestId);
  const corpo = cadenciaSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { data: campanha } = await a.supabase
    .from("demand_campaigns")
    .select("id, pipeline_id")
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!campanha) return campanhaNaoEncontrada(a.t, a.requestId);

  // O destino só vale se a etapa é do funil desta campanha.
  if (corpo.data.end_stage_id) {
    const { data: etapa } = await a.supabase
      .from("crm_stages")
      .select("id")
      .eq("id", corpo.data.end_stage_id)
      .eq("organization_id", a.orgId)
      .eq("pipeline_id", (campanha as { pipeline_id: string | null }).pipeline_id ?? "")
      .maybeSingle();
    if (!etapa) {
      return fail("validation_failed", a.t("A etapa de destino não é do funil da campanha."), 422, {
        requestId: a.requestId,
      });
    }
  }
  // A abordagem de cada passo tem de ser desta campanha.
  const abordagens = [
    ...new Set(corpo.data.steps.flatMap((s) => (s.approach_id ? [s.approach_id] : []))),
  ];
  if (abordagens.length > 0) {
    const { data: validas } = await a.supabase
      .from("demand_campaign_approaches")
      .select("id")
      .eq("organization_id", a.orgId)
      .eq("campaign_id", id)
      .in("id", abordagens);
    if ((validas ?? []).length !== abordagens.length) {
      return fail("validation_failed", a.t("Abordagem inválida."), 422, { requestId: a.requestId });
    }
  }

  const campos = {
    end_action: corpo.data.end_action,
    end_stage_id: corpo.data.end_action === "etapa" ? corpo.data.end_stage_id : null,
  };
  const { data: existente } = await a.supabase
    .from("demand_cadences")
    .select("id")
    .eq("organization_id", a.orgId)
    .eq("campaign_id", id)
    .maybeSingle();
  let cadenciaId = (existente?.id as string | undefined) ?? null;
  if (cadenciaId) {
    const { error } = await a.supabase
      .from("demand_cadences")
      .update(campos)
      .eq("id", cadenciaId)
      .eq("organization_id", a.orgId);
    if (error) {
      return fail("internal_error", a.t("Erro ao salvar a cadência."), 500, {
        requestId: a.requestId,
      });
    }
  } else {
    const { data: criada, error } = await a.supabase
      .from("demand_cadences")
      .insert({ ...campos, organization_id: a.orgId, campaign_id: id, created_by: a.userId })
      .select("id")
      .single();
    if (error || !criada) {
      return fail("internal_error", a.t("Erro ao salvar a cadência."), 500, {
        requestId: a.requestId,
      });
    }
    cadenciaId = criada.id as string;
  }

  // Grava os passos novos primeiro e só então tira os antigos: falha no meio não apaga o desenho.
  const antigos = (await carregarPassos(a.supabase, a.orgId, cadenciaId)).map((p) => p.id);
  const novos = ordenarPassos(corpo.data.steps).map((s, i) => ({
    ...s,
    organization_id: a.orgId,
    cadence_id: cadenciaId,
    position: i,
  }));
  if (novos.length > 0) {
    const { error } = await a.supabase.from("demand_cadence_steps").insert(novos);
    if (error) {
      return fail("internal_error", a.t("Erro ao salvar os passos."), 500, {
        requestId: a.requestId,
      });
    }
  }
  if (antigos.length > 0) {
    await a.supabase
      .from("demand_cadence_steps")
      .delete()
      .eq("organization_id", a.orgId)
      .in("id", antigos);
  }
  return ok({ id: cadenciaId }, { requestId: a.requestId });
}
