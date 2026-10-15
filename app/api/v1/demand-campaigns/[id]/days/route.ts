/**
 * GET    /api/v1/demand-campaigns/[id]/days — o dia a dia da campanha (toda a empresa lê).
 * PUT    /api/v1/demand-campaigns/[id]/days — grava dias (cria ou troca; até 400 por envio; manager+).
 * DELETE /api/v1/demand-campaigns/[id]/days?day=AAAA-MM-DD — apaga um dia (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { campanhaDaOportunidade, type CampanhaDoFunil } from "@/lib/marketing/atribuicao";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import {
  CONTAGEM_VAZIA,
  chavesAutomaticas,
  diaNoFuso,
  extrasDoDia,
  investimentoDoDia,
  type ContagensDoDia,
} from "@/lib/marketing/dia-a-dia-automatico";
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
    .select("pipeline_id, start_date, end_date, channel, budget, budget_period")
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
  let resultado = diasComLeadsDoCrm(dias, leadsPorDia);

  // Fora do tráfego pago nada se digita: os números saem do que o sistema sabe (vendas pagas,
  // ações registradas na ficha, leads do CRM) e o investimento sai do orçamento da campanha.
  const canal = (campanha as { channel?: string } | null)?.channel ?? "trafego_pago";
  const automaticas =
    canal === "trafego_pago" ? [] : chavesAutomaticas(canal as "prospeccao" | "social_media");
  if (campanha && automaticas.length > 0) {
    const { data: org } = await a.supabase
      .from("organizations")
      .select("timezone")
      .eq("id", a.orgId)
      .maybeSingle();
    const fuso = (org?.timezone as string | null) || "America/Sao_Paulo";
    const hoje = diaNoFuso(new Date().toISOString(), fuso);
    const porDia = new Map<string, ContagensDoDia>();
    const dia = (d: string) => {
      let v = porDia.get(d);
      if (!v) {
        v = { ...CONTAGEM_VAZIA };
        porDia.set(d, v);
      }
      return v;
    };
    for (const l of leadsPorDia) dia(l.day).leads = l.leads;

    // Vendas: a primeira parcela recebida conta a venda; o dinheiro entra no dia em que caiu.
    // A venda é a oportunidade (card) da campanha.
    // Do funil da campanha (ou, sem funil dono, as que têm a campanha como origem).
    const { data: todasAsCampanhas } = await a.supabase
      .from("demand_campaigns")
      .select("id, pipeline_id")
      .eq("organization_id", a.orgId)
      .limit(1000);
    const campanhasDoFunil = (todasAsCampanhas ?? []) as CampanhaDoFunil[];
    const { data: oportunidades } = await a.supabase
      .from("crm_leads")
      .select("id, pipeline_id, demand_campaign_id")
      .eq("organization_id", a.orgId)
      .or(
        campanha.pipeline_id
          ? `pipeline_id.eq.${campanha.pipeline_id as string},demand_campaign_id.eq.${id}`
          : `demand_campaign_id.eq.${id}`,
      )
      .limit(5000);
    const idsDeVendas = (
      (oportunidades ?? []) as Array<{
        id: string;
        pipeline_id: string | null;
        demand_campaign_id: string | null;
      }>
    )
      .filter((o) => campanhaDaOportunidade(o, campanhasDoFunil) === id)
      .map((v) => v.id);
    const pagamentos: Array<{ sale_id: string; paid_on: string; amount_cents: number }> = [];
    for (let i = 0; i < idsDeVendas.length; i += 200) {
      const { data } = await a.supabase
        .from("crm_sale_payments")
        .select("lead_id, paid_on, amount_cents, status")
        .eq("organization_id", a.orgId)
        .eq("status", "recebida")
        .in("lead_id", idsDeVendas.slice(i, i + 200));
      for (const p of (data ?? []) as Array<{
        lead_id: string;
        paid_on: string | null;
        amount_cents: number | string;
      }>) {
        if (p.paid_on) {
          pagamentos.push({
            sale_id: p.lead_id,
            paid_on: p.paid_on.slice(0, 10),
            amount_cents: Number(p.amount_cents),
          });
        }
      }
    }
    const primeiraPaga = new Map<string, string>();
    for (const p of pagamentos) {
      dia(p.paid_on).valorTotal += p.amount_cents / 100;
      const atual = primeiraPaga.get(p.sale_id);
      if (!atual || p.paid_on < atual) primeiraPaga.set(p.sale_id, p.paid_on);
    }
    for (const d of primeiraPaga.values()) dia(d).vendas += 1;

    // Ações registradas nos leads da campanha.
    const filtroDeLeads = a.supabase
      .from("crm_leads")
      .select("id")
      .eq("organization_id", a.orgId)
      .limit(5000);
    const { data: leadsDaCampanha } = await (campanha.pipeline_id
      ? filtroDeLeads.eq("pipeline_id", campanha.pipeline_id as string)
      : filtroDeLeads.eq("demand_campaign_id", id));
    const idsDeLeads = ((leadsDaCampanha ?? []) as Array<{ id: string }>).map((l) => l.id);
    for (let i = 0; i < idsDeLeads.length; i += 200) {
      const { data } = await a.supabase
        .from("crm_lead_activities")
        .select("type, payload, performed_at")
        .eq("organization_id", a.orgId)
        .in("lead_id", idsDeLeads.slice(i, i + 200))
        .in("type", ["note", "appointment_scheduled", "appointment_completed", "proposal_sent"])
        .limit(5000);
      for (const at of (data ?? []) as Array<{
        type: string;
        payload: Record<string, unknown> | null;
        performed_at: string;
      }>) {
        const d = dia(diaNoFuso(at.performed_at, fuso));
        const acao = typeof at.payload?.acao === "string" ? at.payload.acao : "";
        if (at.type === "appointment_scheduled") d.reunioesAgendadas += 1;
        else if (at.type === "appointment_completed") d.reunioesFeitas += 1;
        else if (at.type === "proposal_sent") d.propostas += 1;
        else if (at.type === "note") {
          if (acao === "ligacao" || acao === "mensagem" || acao === "nao_atendeu") d.abordagens += 1;
          else if (acao === "reuniao") d.reunioesFeitas += 1;
          else if (acao === "proposta") d.propostas += 1;
        }
      }
    }

    const base = new Map(resultado.map((d) => [d.day, d]));
    for (const [d, c] of porDia) {
      const existente = base.get(d);
      const linha = existente ?? {
        day: d,
        impressions: 0,
        reach: 0,
        link_clicks: 0,
        lp_views: 0,
        leads: c.leads,
        spend: 0,
        extras: {},
        source: "crm" as const,
      };
      base.set(d, { ...linha, extras: { ...linha.extras, ...extrasDoDia(canal as never, c) } });
    }
    // O investimento: o orçamento da campanha, dia a dia (do início até hoje).
    const cp = campanha as unknown as {
      budget: number | null;
      budget_period: "total" | "diario" | "semanal" | "mensal";
      start_date: string | null;
      end_date: string | null;
    };
    if (cp.start_date) {
      const fim = cp.end_date && cp.end_date < hoje ? cp.end_date : hoje;
      for (let d = cp.start_date; d <= fim; d = new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
        const valor = investimentoDoDia(cp, d, hoje);
        if (valor === null) continue;
        const linha = base.get(d) ?? {
          day: d,
          impressions: 0,
          reach: 0,
          link_clicks: 0,
          lp_views: 0,
          leads: 0,
          spend: 0,
          extras: extrasDoDia(canal as never, CONTAGEM_VAZIA),
          source: "crm" as const,
        };
        base.set(d, { ...linha, spend: valor });
      }
    }
    resultado = [...base.values()].sort((x, y) => x.day.localeCompare(y.day));
  }

  return ok(
    {
      dias: resultado,
      funil_definido: Boolean(campanha?.pipeline_id),
      automatico: { chaves: automaticas, investimento: automaticas.length > 0 },
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
