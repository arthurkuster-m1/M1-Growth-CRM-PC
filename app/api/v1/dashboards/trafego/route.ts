/**
 * GET /api/v1/dashboards/trafego?de=&ate=&campanhas=id,id — os números do dashboard de Tráfego
 * Pago: dia a dia consolidado, totais do período e do período anterior (mesmo tamanho), e o
 * detalhe por campanha, anúncio e landing page. Toda a empresa lê (viewer+): é o painel do cliente.
 *
 * Fontes: investimento e entrega vêm do Meta (`demand_campaign_days`); leads são pessoas do CRM;
 * vendas e faturamento vêm das parcelas RECEBIDAS, pela origem da venda.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import {
  montarDias,
  periodoAnterior,
  somarDias_,
  type LinhaDoMeta,
  type PagamentoRecebido,
} from "@/lib/dashboards/trafego";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const q = req.nextUrl.searchParams;
  const de = dia.safeParse(q.get("de"));
  const ate = dia.safeParse(q.get("ate"));
  if (!de.success || !ate.success || de.data > ate.data) {
    return fail("validation_failed", a.t("Período inválido."), 422, { requestId: a.requestId });
  }
  const anterior = periodoAnterior(de.data, ate.data);
  const pedidas = (q.get("campanhas") ?? "")
    .split(",")
    .filter((v) => z.string().uuid().safeParse(v).success);

  const { data: org } = await a.supabase
    .from("organizations")
    .select("timezone")
    .eq("id", a.orgId)
    .maybeSingle();
  const fuso = (org?.timezone as string | null) || "America/Sao_Paulo";

  // As campanhas de tráfego pago da empresa (o catálogo do filtro) e as escolhidas.
  const { data: catalogoBruto, error: erroCatalogo } = await a.supabase
    .from("demand_campaigns")
    .select("id, name, channel, pipeline_id")
    .eq("organization_id", a.orgId)
    .eq("channel", "trafego_pago")
    .order("position", { ascending: true })
    .limit(500);
  if (erroCatalogo) {
    return fail("internal_error", a.t("Erro ao carregar as campanhas."), 500, {
      requestId: a.requestId,
    });
  }
  const catalogo = (catalogoBruto ?? []) as Array<{
    id: string;
    name: string;
    channel: string;
    pipeline_id: string | null;
  }>;
  const escolhidas = catalogo.filter((c) => pedidas.length === 0 || pedidas.includes(c.id));
  const ids = escolhidas.map((c) => c.id);

  if (ids.length === 0) {
    return ok(
      {
        de: de.data,
        ate: ate.data,
        anterior,
        dias: [],
        totais: somarDias_([]),
        totaisAnterior: somarDias_([]),
        campanhas: [],
        anuncios: [],
        paginas: [],
        catalogo: catalogo.map((c) => ({ id: c.id, nome: c.name })),
      },
      { requestId: a.requestId },
    );
  }

  // Meta: entrega e gasto por dia (período e anterior de uma vez).
  const { data: linhasMeta } = await a.supabase
    .from("demand_campaign_days")
    .select("campaign_id, day, impressions, reach, link_clicks, lp_views, spend")
    .eq("organization_id", a.orgId)
    .in("campaign_id", ids)
    .gte("day", anterior.de)
    .lte("day", ate.data)
    .limit(20000);
  const meta: LinhaDoMeta[] = ((linhasMeta ?? []) as Array<Record<string, unknown>>).map((l) => ({
    campaign_id: String(l.campaign_id),
    day: String(l.day).slice(0, 10),
    impressions: n(l.impressions),
    reach: n(l.reach),
    link_clicks: n(l.link_clicks),
    lp_views: n(l.lp_views),
    spend: n(l.spend),
  }));

  // Leads do CRM por dia, por campanha (as pessoas únicas entram uma vez no total do dia).
  const leadsDoDia = new Map<string, number>();
  const leadsPorCampanha = new Map<string, number>();
  await Promise.all(
    escolhidas.map(async (c) => {
      const { data } = await a.supabase.rpc("fn_demand_campaign_leads_by_day", {
        p_org: a.orgId,
        p_pipeline: c.pipeline_id,
        p_from: anterior.de,
        p_to: ate.data,
        p_tz: fuso,
        p_campaign: c.id,
      });
      for (const l of (data ?? []) as Array<{ day: string; leads: number }>) {
        const d = String(l.day).slice(0, 10);
        leadsDoDia.set(d, (leadsDoDia.get(d) ?? 0) + n(l.leads));
        if (d >= de.data) {
          leadsPorCampanha.set(c.id, (leadsPorCampanha.get(c.id) ?? 0) + n(l.leads));
        }
      }
    }),
  );

  // Vendas e dinheiro recebido, pela origem da venda.
  const { data: vendasBrutas } = await a.supabase
    .from("crm_sales")
    .select("id, demand_campaign_id, demand_creative_id, demand_landing_page_id")
    .eq("organization_id", a.orgId)
    .in("demand_campaign_id", ids)
    .in("status", ["comprometida", "concluida"])
    .limit(5000);
  const vendas = (vendasBrutas ?? []) as Array<{
    id: string;
    demand_campaign_id: string | null;
    demand_creative_id: string | null;
    demand_landing_page_id: string | null;
  }>;
  const porVenda = new Map(vendas.map((v) => [v.id, v]));
  const pagamentos: PagamentoRecebido[] = [];
  const idsDeVendas = vendas.map((v) => v.id);
  for (let i = 0; i < idsDeVendas.length; i += 200) {
    const { data } = await a.supabase
      .from("crm_sale_payments")
      .select("sale_id, paid_on, amount_cents")
      .eq("organization_id", a.orgId)
      .eq("status", "recebida")
      .gte("paid_on", anterior.de)
      .lte("paid_on", ate.data)
      .in("sale_id", idsDeVendas.slice(i, i + 200));
    for (const p of (data ?? []) as Array<{
      sale_id: string;
      paid_on: string | null;
      amount_cents: number | string;
    }>) {
      if (!p.paid_on) continue;
      pagamentos.push({
        sale_id: p.sale_id,
        campaign_id: porVenda.get(p.sale_id)?.demand_campaign_id ?? null,
        paid_on: String(p.paid_on).slice(0, 10),
        amount: n(p.amount_cents) / 100,
      });
    }
  }

  const naJanelaAtual = <T extends { day?: string; paid_on?: string }>(x: T) =>
    (x.day ?? x.paid_on ?? "") >= de.data;
  const metaAtual = meta.filter(naJanelaAtual);
  const metaAnterior = meta.filter((l) => !naJanelaAtual(l));
  const pagAtual = pagamentos.filter(naJanelaAtual);
  const pagAnterior = pagamentos.filter((p) => !naJanelaAtual(p));
  const leadsAtual = new Map([...leadsDoDia].filter(([d]) => d >= de.data));
  const leadsAnterior = new Map([...leadsDoDia].filter(([d]) => d < de.data));

  const dias = montarDias(de.data, ate.data, metaAtual, leadsAtual, pagAtual);
  const diasAnteriores = montarDias(anterior.de, anterior.ate, metaAnterior, leadsAnterior, pagAnterior);

  // Por campanha (período atual).
  const campanhas = escolhidas.map((c) => {
    const m = metaAtual.filter((l) => l.campaign_id === c.id);
    const p = pagAtual.filter((x) => x.campaign_id === c.id);
    return {
      id: c.id,
      nome: c.name,
      canal: "Meta Ads",
      investido: Math.round(m.reduce((s, l) => s + l.spend, 0) * 100) / 100,
      impressoes: m.reduce((s, l) => s + l.impressions, 0),
      cliques: m.reduce((s, l) => s + l.link_clicks, 0),
      viewsLP: m.reduce((s, l) => s + l.lp_views, 0),
      leads: leadsPorCampanha.get(c.id) ?? 0,
      vendas: new Set(p.map((x) => x.sale_id)).size,
      recebido: Math.round(p.reduce((s, x) => s + x.amount, 0) * 100) / 100,
    };
  });

  // Por anúncio e por landing page: leads (CRM) e vendas/dinheiro (origem da venda).
  const { data: leadsDeOrigem } = await a.supabase
    .from("crm_leads")
    .select("demand_creative_id, demand_landing_page_id, contact_id, id")
    .eq("organization_id", a.orgId)
    .in("demand_campaign_id", ids)
    .gte("created_at", `${de.data}T00:00:00-03:00`)
    .lt("created_at", `${ate.data}T23:59:59-03:00`)
    .limit(5000);
  const agrupar = (
    campo: "demand_creative_id" | "demand_landing_page_id",
    nomes: Map<string, string>,
  ) => {
    const linhas = new Map<string, { id: string; nome: string; leads: Set<string>; vendas: Set<string>; recebido: number }>();
    const pegar = (id: string) => {
      let l = linhas.get(id);
      if (!l) {
        l = { id, nome: nomes.get(id) ?? "—", leads: new Set(), vendas: new Set(), recebido: 0 };
        linhas.set(id, l);
      }
      return l;
    };
    for (const l of (leadsDeOrigem ?? []) as Array<Record<string, string | null>>) {
      const id = l[campo];
      if (id) pegar(id).leads.add(String(l.contact_id ?? l.id));
    }
    for (const p of pagAtual) {
      const id = porVenda.get(p.sale_id)?.[campo];
      if (!id) continue;
      const linha = pegar(id);
      linha.vendas.add(p.sale_id);
      linha.recebido += p.amount;
    }
    return [...linhas.values()]
      .map((l) => ({
        id: l.id,
        nome: l.nome,
        leads: l.leads.size,
        vendas: l.vendas.size,
        recebido: Math.round(l.recebido * 100) / 100,
      }))
      .sort((x, y) => y.recebido - x.recebido || y.leads - x.leads);
  };
  const [{ data: criativos }, { data: paginas }] = await Promise.all([
    a.supabase
      .from("demand_campaign_creatives")
      .select("id, name")
      .eq("organization_id", a.orgId)
      .in("campaign_id", ids)
      .limit(3000),
    a.supabase
      .from("demand_campaign_landing_pages")
      .select("id, name")
      .eq("organization_id", a.orgId)
      .in("campaign_id", ids)
      .limit(2000),
  ]);
  const nomesDeCriativo = new Map(
    ((criativos ?? []) as Array<{ id: string; name: string | null }>).map((c) => [c.id, c.name ?? "—"]),
  );
  const nomesDePagina = new Map(
    ((paginas ?? []) as Array<{ id: string; name: string | null }>).map((c) => [c.id, c.name ?? "—"]),
  );

  return ok(
    {
      de: de.data,
      ate: ate.data,
      anterior,
      dias,
      totais: somarDias_(dias),
      totaisAnterior: somarDias_(diasAnteriores),
      campanhas,
      anuncios: agrupar("demand_creative_id", nomesDeCriativo),
      paginas: agrupar("demand_landing_page_id", nomesDePagina),
      catalogo: catalogo.map((c) => ({ id: c.id, nome: c.name })),
    },
    { requestId: a.requestId },
  );
}
