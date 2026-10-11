/**
 * GET    /api/v1/demand-campaigns/[id]/days — o dia a dia da campanha (toda a empresa lê).
 * PUT    /api/v1/demand-campaigns/[id]/days — grava dias (cria ou troca; até 400 por envio; manager+).
 * DELETE /api/v1/demand-campaigns/[id]/days?day=AAAA-MM-DD — apaga um dia (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import {
  COLUNAS_DO_DIA,
  diaDaLinha,
  diasComLeadsDoCrm,
  gravarDiasSchema,
  janelaDosLeads,
} from "@/lib/marketing/campanhas-resumo";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const idValido = (id: string) => z.string().uuid().safeParse(id).success;

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!idValido(id)) return campanhaNaoEncontrada(a.t, a.requestId);
  const { data, error } = await a.supabase
    .from("demand_campaign_days")
    .select(COLUNAS_DO_DIA)
    .eq("organization_id", a.orgId)
    .eq("campaign_id", id)
    .order("day", { ascending: true })
    .limit(2000);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar o dia a dia."), 500, {
      requestId: a.requestId,
    });
  }
  const dias = (data ?? []).map((l) => diaDaLinha(l as Record<string, unknown>));

  // Os LEADS são sempre os do CRM: contatos que entraram no funil da campanha, por dia. Nunca os
  // do Meta nem os digitados — decisão do Arthur (variação falsa).
  const { data: campanha } = await a.supabase
    .from("demand_campaigns")
    .select("pipeline_id, start_date, end_date")
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  let leadsPorDia: Array<{ day: string; leads: number }> = [];
  const janela = campanha ? janelaDosLeads(campanha as never) : null;
  if (janela && campanha) {
    const { data: org } = await a.supabase
      .from("organizations")
      .select("timezone")
      .eq("id", a.orgId)
      .maybeSingle();
    const { data: conta, error: erroDeLeads } = await a.supabase.rpc(
      "fn_demand_campaign_leads_by_day",
      {
        p_org: a.orgId,
        p_pipeline: campanha.pipeline_id ?? null,
        p_from: janela.de,
        p_to: janela.ate,
        p_tz: (org?.timezone as string | null) || "America/Sao_Paulo",
        p_campaign: id,
      },
    );
    if (!erroDeLeads) leadsPorDia = (conta ?? []) as typeof leadsPorDia;
  }
  return ok(
    {
      dias: diasComLeadsDoCrm(dias, leadsPorDia),
      funil_definido: Boolean(campanha?.pipeline_id),
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
  const corpo = gravarDiasSchema.safeParse(await req.json().catch(() => null));
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

  // Um dia repetido no mesmo envio vale o último.
  const porDia = new Map(corpo.data.dias.map((d) => [d.day, d]));
  const linhas = [...porDia.values()].map((d) => ({
    organization_id: a.orgId,
    campaign_id: id,
    day: d.day,
    impressions: d.impressions,
    reach: d.reach,
    link_clicks: d.link_clicks,
    lp_views: d.lp_views,
    // Os leads são os do CRM (a leitura os troca); aqui não se guarda nenhum.
    leads: 0,
    spend: d.spend,
    extras: d.extras,
    source: corpo.data.source,
  }));
  const { error } = await a.supabase
    .from("demand_campaign_days")
    .upsert(linhas, { onConflict: "campaign_id,day" });
  if (error) {
    return fail("internal_error", a.t("Erro ao salvar o dia a dia."), 500, {
      requestId: a.requestId,
    });
  }
  return ok({ gravados: linhas.length }, { requestId: a.requestId });
}

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  const dia = req.nextUrl.searchParams.get("day") ?? "";
  if (!idValido(id) || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  const { error } = await a.supabase
    .from("demand_campaign_days")
    .delete()
    .eq("organization_id", a.orgId)
    .eq("campaign_id", id)
    .eq("day", dia);
  if (error) {
    return fail("internal_error", a.t("Erro ao apagar o dia."), 500, { requestId: a.requestId });
  }
  return ok({ apagado: true }, { requestId: a.requestId });
}
