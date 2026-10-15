/**
 * GET /api/v1/demand-campaigns/[id]/origem — de onde vieram os leads da campanha: por criativo,
 * por landing page e por conjunto de anúncios (a empresa lê). Os leads são os do CRM; o gasto
 * por criativo vem do Meta e o CPL real sai da divisão.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { janelaDaSync } from "@/lib/marketing/campanhas-resumo";
import { janelaDoPeriodo } from "@/lib/marketing/periodos";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import { contarOrigemDosLeads, type LeadDaOrigem } from "@/lib/marketing/origem-dos-leads";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const LIMITE = 5000;

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);

  const { data: c } = await a.supabase
    .from("demand_campaigns")
    .select("id, pipeline_id, start_date, end_date, goal_period, continuous")
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!c) return campanhaNaoEncontrada(a.t, a.requestId);

  const { data: org } = await a.supabase
    .from("organizations")
    .select("timezone")
    .eq("id", a.orgId)
    .maybeSingle();
  const fuso = (org?.timezone as string | null) || "America/Sao_Paulo";
  // Meta mensal (ou contínua): a janela é o mês corrente; senão, do início da campanha até hoje.
  const hojeLocal = new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date());
  const mensal = c.goal_period === "mensal";
  const padrao = mensal
    ? (({ de, ate }) => ({ de, ate }))(janelaDoPeriodo("mes", hojeLocal))
    : janelaDaSync(
        { start_date: c.start_date as string | null, end_date: c.end_date as string | null },
        new Date(),
      );
  // Período escolhido na tela (atalho ou datas livres); sem ele vale o da campanha.
  const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const deP = dia.safeParse(req.nextUrl.searchParams.get("de"));
  const ateP = dia.safeParse(req.nextUrl.searchParams.get("ate"));
  const personalizado = deP.success && ateP.success && deP.data <= ateP.data;
  const janela = personalizado ? { de: deP.data, ate: ateP.data } : padrao;
  if (!janela) {
    return ok({ ...contarOrigemDosLeads([]), de: null, ate: null }, { requestId: a.requestId });
  }

  const filtro = c.pipeline_id
    ? `demand_campaign_id.eq.${id},pipeline_id.eq.${c.pipeline_id}`
    : `demand_campaign_id.eq.${id}`;
  const { data: leads, error } = await a.supabase
    .from("crm_leads")
    .select(
      "id, contact_id, demand_creative_id, demand_landing_page_id, source_metadata, created_at, stage:crm_stages!crm_leads_stage_id_fkey(tipo), contact:contacts(is_mql)",
    )
    .eq("organization_id", a.orgId)
    .or(filtro)
    .gte("created_at", `${janela.de}T00:00:00-03:00`)
    .limit(LIMITE);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar a origem dos leads."), 500, {
      requestId: a.requestId,
    });
  }

  // Nome e conjunto de cada anúncio, pelo cache (tabela só do servidor: leitura com o admin).
  const lista = (leads ?? []) as Array<{
    id: string;
    contact_id: string | null;
    demand_creative_id: string | null;
    demand_landing_page_id: string | null;
    source_metadata: Record<string, unknown> | null;
    created_at: string;
    stage: { tipo: string | null } | { tipo: string | null }[] | null;
    contact: { is_mql: boolean } | { is_mql: boolean }[] | null;
  }>;
  const dentro = lista.filter((l) => {
    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date(l.created_at));
    return dia >= janela.de && dia <= janela.ate;
  });
  const adIds = [
    ...new Set(
      dentro
        .map((l) => l.source_metadata?.ad_id)
        .filter((v): v is string => typeof v === "string" && v !== ""),
    ),
  ];
  const cache = new Map<string, { adset_id: string | null; adset_name: string | null }>();
  if (adIds.length > 0) {
    const { data: linhas } = await createAdminClient()
      .from("ad_hierarchy_cache")
      .select("ad_id, adset_id, adset_name")
      .eq("organization_id", a.orgId)
      .eq("platform", "meta_ads")
      .in("ad_id", adIds);
    for (const h of linhas ?? []) {
      cache.set(h.ad_id as string, {
        adset_id: (h.adset_id as string | null) ?? null,
        adset_name: (h.adset_name as string | null) ?? null,
      });
    }
  }

  const entrada: LeadDaOrigem[] = dentro.map((l) => {
    const meta = l.source_metadata ?? {};
    const utmTerm =
      typeof meta.utm_term === "string" && meta.utm_term !== "" ? meta.utm_term : null;
    const adId = typeof meta.ad_id === "string" ? meta.ad_id : null;
    const h = adId ? cache.get(adId) : undefined;
    const etapa = Array.isArray(l.stage) ? l.stage[0] : l.stage;
    const pessoa = Array.isArray(l.contact) ? l.contact[0] : l.contact;
    return {
      desqualificado: etapa?.tipo === "desqualificado",
      mql: etapa?.tipo === "qualificada" || pessoa?.is_mql === true,
      contato: l.contact_id ?? l.id,
      criativoId: l.demand_creative_id,
      landingPageId: l.demand_landing_page_id,
      conjuntoId: utmTerm ?? h?.adset_id ?? null,
      conjuntoNome: h?.adset_name ?? null,
    };
  });

  // O FATURAMENTO vem da BASE DE VENDAS, pela origem da venda (que pode ou não ser a do lead; a do
  // lead serve para Leads e CPL). Só conta dinheiro que JÁ ENTROU: uma venda (comprometida ou
  // concluída) só é "venda" aqui se tem ao menos uma parcela recebida — mesmo um sinal — e o
  // faturamento é a soma das parcelas recebidas. Com período escolhido, vale o que foi recebido
  // dentro dele. Quem não vê dinheiro (viewer) recebe zeros — a RLS filtra.
  const faturamento = {
    recebido: 0,
    aReceber: 0,
    vendas: 0,
    porCriativo: {} as Record<string, number>,
    porLandingPage: {} as Record<string, number>,
    /** Quantas vendas (com algo pago) vieram de cada criativo e de cada landing page. */
    vendasPorCriativo: {} as Record<string, number>,
    vendasPorLandingPage: {} as Record<string, number>,
  };
  const { data: vendas } = await a.supabase
    .from("crm_sales")
    .select(
      "id, status, amount_cents, paid_on, closed_on, demand_creative_id, demand_landing_page_id, payments:crm_sale_payments(status, amount_cents, paid_on)",
    )
    .eq("organization_id", a.orgId)
    .eq("demand_campaign_id", id)
    .in("status", ["comprometida", "concluida"])
    .limit(LIMITE);
  const dentroDaJanela = (d: string | null | undefined) => {
    if (!personalizado) return true;
    const dia2 = d ? String(d).slice(0, 10) : "";
    return dia2 !== "" && dia2 >= janela.de && dia2 <= janela.ate;
  };
  for (const v of (vendas ?? []) as Array<{
    status: string;
    amount_cents: number | string;
    paid_on: string | null;
    closed_on: string | null;
    demand_creative_id: string | null;
    demand_landing_page_id: string | null;
    payments: Array<{ status: string; amount_cents: number | string; paid_on: string | null }> | null;
  }>) {
    const parcelas = v.payments ?? [];
    let recebido = 0;
    let previsto = 0;
    if (parcelas.length > 0) {
      for (const p of parcelas) {
        if (p.status === "recebida") {
          if (dentroDaJanela(p.paid_on)) recebido += Number(p.amount_cents);
        } else if (p.status === "prevista") previsto += Number(p.amount_cents);
      }
    } else if (v.status === "concluida") {
      if (dentroDaJanela(v.paid_on ?? v.closed_on)) recebido = Number(v.amount_cents);
    } else previsto = Number(v.amount_cents);
    faturamento.aReceber += previsto;
    // Nada pago (no período): ainda não é venda para a análise.
    if (recebido <= 0) continue;
    faturamento.recebido += recebido;
    faturamento.vendas += 1;
    if (v.demand_creative_id) {
      faturamento.porCriativo[v.demand_creative_id] =
        (faturamento.porCriativo[v.demand_creative_id] ?? 0) + recebido;
      faturamento.vendasPorCriativo[v.demand_creative_id] =
        (faturamento.vendasPorCriativo[v.demand_creative_id] ?? 0) + 1;
    }
    if (v.demand_landing_page_id) {
      faturamento.porLandingPage[v.demand_landing_page_id] =
        (faturamento.porLandingPage[v.demand_landing_page_id] ?? 0) + recebido;
      faturamento.vendasPorLandingPage[v.demand_landing_page_id] =
        (faturamento.vendasPorLandingPage[v.demand_landing_page_id] ?? 0) + 1;
    }
  }

  const { data: dias } = await a.supabase
    .from("demand_campaign_days")
    .select("spend")
    .eq("organization_id", a.orgId)
    .eq("campaign_id", id)
    .gte("day", janela.de)
    .lte("day", janela.ate)
    .limit(1000);
  const investido = (dias ?? []).reduce((s2, d) => s2 + (Number(d.spend) || 0), 0);

  return ok(
    {
      ...contarOrigemDosLeads(entrada),
      faturamento,
      investido: Math.round(investido * 100) / 100,
      mensal,
      de: janela.de,
      ate: janela.ate,
    },
    { requestId: a.requestId },
  );
}
