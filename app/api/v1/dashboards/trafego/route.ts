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
import { campanhaDaOportunidade, type CampanhaDoFunil } from "@/lib/marketing/atribuicao";
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
    .select("id, name, channel, pipeline_id, platform_campaigns")
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
    platform_campaigns: Array<{ id: string | null }> | null;
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
        conjuntos: [],
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

  // De quem é cada oportunidade: da campanha dona do funil em que ela está (a campanha de origem
  // só vale quando o funil não é de nenhuma campanha). Lead e dinheiro seguem essa regra.
  const { data: todasAsCampanhas } = await a.supabase
    .from("demand_campaigns")
    .select("id, pipeline_id")
    .eq("organization_id", a.orgId)
    .limit(1000);
  const campanhasDoFunil = (todasAsCampanhas ?? []) as CampanhaDoFunil[];
  const funisDasEscolhidas = campanhasDoFunil
    .filter((c) => ids.includes(c.id) && c.pipeline_id)
    .map((c) => c.pipeline_id as string);
  const filtroDeDonas = [
    ...(funisDasEscolhidas.length > 0 ? [`pipeline_id.in.(${funisDasEscolhidas.join(",")})`] : []),
    `demand_campaign_id.in.(${ids.join(",")})`,
  ].join(",");
  const donaDa = (o: { pipeline_id: string | null; demand_campaign_id: string | null }) =>
    campanhaDaOportunidade(o, campanhasDoFunil);

  // Vendas e dinheiro recebido, pela campanha dona do funil.
  const { data: vendasBrutas } = await a.supabase
    .from("crm_leads")
    .select("id, pipeline_id, demand_campaign_id, demand_creative_id, demand_landing_page_id")
    .eq("organization_id", a.orgId)
    .or(filtroDeDonas)
    .neq("status", "lost")
    .limit(5000);
  // A venda é a oportunidade: o id da venda é o do card.
  const vendas = ((vendasBrutas ?? []) as Array<{
    id: string;
    pipeline_id: string | null;
    demand_campaign_id: string | null;
    demand_creative_id: string | null;
    demand_landing_page_id: string | null;
  }>)
    .map((o) => {
      const dona = donaDa(o);
      // Anúncio e página só recebem o que fechou no PRÓPRIO funil de origem: o lead reaproveitado
      // em outra campanha mantém a origem, mas o dinheiro dele não é do anúncio antigo.
      const propria = o.demand_campaign_id === null || o.demand_campaign_id === dona;
      return { ...o, demand_campaign_id: dona, origem_propria: propria };
    })
    .filter((o) => o.demand_campaign_id !== null && ids.includes(o.demand_campaign_id))
    .map((o) => ({ ...o, lead_id: o.id as string | null }));
  const porVenda = new Map(vendas.map((v) => [v.id, v]));
  const pagamentos: PagamentoRecebido[] = [];
  const idsDeVendas = vendas.map((v) => v.id);
  for (let i = 0; i < idsDeVendas.length; i += 200) {
    const { data } = await a.supabase
      .from("crm_sale_payments")
      .select("lead_id, paid_on, amount_cents")
      .eq("organization_id", a.orgId)
      .eq("status", "recebida")
      .gte("paid_on", anterior.de)
      .lte("paid_on", ate.data)
      .in("lead_id", idsDeVendas.slice(i, i + 200));
    for (const p of (data ?? []) as Array<{
      lead_id: string;
      paid_on: string | null;
      amount_cents: number | string;
    }>) {
      if (!p.paid_on) continue;
      pagamentos.push({
        sale_id: p.lead_id,
        campaign_id: porVenda.get(p.lead_id)?.demand_campaign_id ?? null,
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
    .select(
      "demand_creative_id, demand_landing_page_id, contact_id, id, pipeline_id, demand_campaign_id, stage:crm_stages!crm_leads_stage_id_fkey(tipo)",
    )
    .eq("organization_id", a.orgId)
    .or(filtroDeDonas)
    .gte("created_at", `${de.data}T00:00:00-03:00`)
    .lt("created_at", `${ate.data}T23:59:59-03:00`)
    .limit(5000);
  const agrupar = (
    campo: "demand_creative_id" | "demand_landing_page_id",
    nomes: Map<string, string>,
  ) => {
    const linhas = new Map<
      string,
      { id: string; nome: string; leads: Set<string>; desq: Set<string>; vendas: Set<string>; recebido: number }
    >();
    const pegar = (id: string) => {
      let l = linhas.get(id);
      if (!l) {
        l = {
          id,
          nome: nomes.get(id) ?? "—",
          leads: new Set(),
          desq: new Set(),
          vendas: new Set(),
          recebido: 0,
        };
        linhas.set(id, l);
      }
      return l;
    };
    for (const l of ((leadsDeOrigem ?? []) as unknown as Array<{
      pipeline_id: string | null;
      demand_campaign_id: string | null;
    }>).filter((o) => {
      const dona = donaDa(o);
      return (
        dona !== null &&
        ids.includes(dona) &&
        (o.demand_campaign_id === null || o.demand_campaign_id === dona)
      );
    }) as unknown as Array<
      Record<string, string | null> & { stage: { tipo: string | null } | { tipo: string | null }[] | null }
    >) {
      const id = l[campo];
      if (!id) continue;
      const linha = pegar(id);
      const pessoa = String(l.contact_id ?? l.id);
      linha.leads.add(pessoa);
      const etapa = Array.isArray(l.stage) ? l.stage[0] : l.stage;
      if (etapa?.tipo === "desqualificado") linha.desq.add(pessoa);
    }
    for (const p of pagAtual) {
      const venda = porVenda.get(p.sale_id);
      if (!venda?.origem_propria) continue;
      const id = venda[campo];
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
        desqualificados: l.desq.size,
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

  // ── Por anúncio e por conjunto (base diária por anúncio do Meta) ──────────────────────────────
  // Muitos anúncios têm o mesmo nome: o id do anúncio os separa, e a tela mostra campanha e
  // conjunto junto do nome.
  const idsDoMeta = [
    ...new Set(
      escolhidas.flatMap((c) =>
        (c.platform_campaigns ?? []).map((p) => p.id).filter((x): x is string => Boolean(x)),
      ),
    ),
  ];
  interface LinhaDoAnuncio {
    id: string;
    nome: string;
    campanha: string;
    conjuntoId: string;
    conjunto: string;
    investido: number;
    impressoes: number;
    cliques: number;
    viewsLP: number;
    leads: number;
    desqualificados: number;
    vendas: number;
    recebido: number;
  }
  const porAnuncio = new Map<string, LinhaDoAnuncio>();
  if (idsDoMeta.length > 0) {
    const { data: linhasAd } = await a.supabase
      .from("ad_insights_daily")
      .select(
        "ad_id, ad_name, adset_id, adset_name, campaign_name, spend, impressions, link_clicks, lp_views",
      )
      .eq("organization_id", a.orgId)
      .eq("platform", "meta_ads")
      .in("campaign_id", idsDoMeta)
      .gte("day", de.data)
      .lte("day", ate.data)
      .limit(20000);
    for (const l of (linhasAd ?? []) as Array<Record<string, unknown>>) {
      const id = String(l.ad_id);
      const x = porAnuncio.get(id) ?? {
        id,
        nome: String(l.ad_name ?? "—"),
        campanha: String(l.campaign_name ?? ""),
        conjuntoId: String(l.adset_id ?? ""),
        conjunto: String(l.adset_name ?? ""),
        investido: 0,
        impressoes: 0,
        cliques: 0,
        viewsLP: 0,
        leads: 0,
        desqualificados: 0,
        vendas: 0,
        recebido: 0,
      };
      x.investido += n(l.spend);
      x.impressoes += n(l.impressions);
      x.cliques += n(l.link_clicks);
      x.viewsLP += n(l.lp_views);
      porAnuncio.set(id, x);
    }
  }
  if (porAnuncio.size > 0) {
    const idsDeAnuncio = [...porAnuncio.keys()];
    // Leads: quem entrou por aquele anúncio (id do anúncio gravado na origem do lead).
    for (let i = 0; i < idsDeAnuncio.length; i += 100) {
      const { data } = await a.supabase
        .from("crm_leads")
        .select(
          "id, contact_id, source_metadata, stage:crm_stages!crm_leads_stage_id_fkey(tipo)",
        )
        .eq("organization_id", a.orgId)
        .in("source_metadata->>ad_id", idsDeAnuncio.slice(i, i + 100))
        .gte("created_at", `${de.data}T00:00:00-03:00`)
        .lt("created_at", `${ate.data}T23:59:59-03:00`)
        .limit(5000);
      const vistos = new Map<string, Set<string>>();
      const desqualificados = new Map<string, Set<string>>();
      for (const l of (data ?? []) as unknown as Array<{
        id: string;
        contact_id: string | null;
        source_metadata: Record<string, unknown> | null;
        stage: { tipo: string | null } | { tipo: string | null }[] | null;
      }>) {
        const ad = String(l.source_metadata?.ad_id ?? "");
        if (!porAnuncio.has(ad)) continue;
        const pessoa = String(l.contact_id ?? l.id);
        const set = vistos.get(ad) ?? new Set<string>();
        set.add(pessoa);
        vistos.set(ad, set);
        const etapa = Array.isArray(l.stage) ? l.stage[0] : l.stage;
        if (etapa?.tipo === "desqualificado") {
          const d = desqualificados.get(ad) ?? new Set<string>();
          d.add(pessoa);
          desqualificados.set(ad, d);
        }
      }
      for (const [ad, set] of vistos) porAnuncio.get(ad)!.leads += set.size;
      for (const [ad, set] of desqualificados) porAnuncio.get(ad)!.desqualificados += set.size;
    }
    // Vendas e dinheiro: o anúncio do lead da venda.
    const idsDeLeadDasVendas = [
      ...new Set(
        vendas.filter((v) => v.origem_propria).map((v) => v.lead_id).filter((x): x is string => Boolean(x)),
      ),
    ];
    const anuncioDoLead = new Map<string, string>();
    for (let i = 0; i < idsDeLeadDasVendas.length; i += 100) {
      const { data } = await a.supabase
        .from("crm_leads")
        .select("id, source_metadata")
        .eq("organization_id", a.orgId)
        .in("id", idsDeLeadDasVendas.slice(i, i + 100));
      for (const l of (data ?? []) as Array<{
        id: string;
        source_metadata: Record<string, unknown> | null;
      }>) {
        const ad = String(l.source_metadata?.ad_id ?? "");
        if (ad) anuncioDoLead.set(l.id, ad);
      }
    }
    const vendasPorAnuncio = new Map<string, Set<string>>();
    for (const p of pagAtual) {
      const venda = porVenda.get(p.sale_id);
      const ad = venda?.lead_id ? anuncioDoLead.get(venda.lead_id) : undefined;
      const x = ad ? porAnuncio.get(ad) : undefined;
      if (!x || !ad) continue;
      x.recebido += p.amount;
      const set = vendasPorAnuncio.get(ad) ?? new Set<string>();
      set.add(p.sale_id);
      vendasPorAnuncio.set(ad, set);
    }
    for (const [ad, set] of vendasPorAnuncio) porAnuncio.get(ad)!.vendas = set.size;
  }
  const arredonda = (v: number) => Math.round(v * 100) / 100;
  const anunciosDoMeta = [...porAnuncio.values()]
    .map((x) => ({ ...x, investido: arredonda(x.investido), recebido: arredonda(x.recebido) }))
    .sort((x, y) => y.investido - x.investido);
  const conjuntos = new Map<
    string,
    {
      id: string;
      nome: string;
      campanha: string;
      anuncios: number;
      investido: number;
      impressoes: number;
      cliques: number;
      leads: number;
      desqualificados: number;
      vendas: number;
      recebido: number;
    }
  >();
  for (const x of anunciosDoMeta) {
    const chave = x.conjuntoId || x.conjunto;
    const c = conjuntos.get(chave) ?? {
      id: chave,
      nome: x.conjunto || "—",
      campanha: x.campanha,
      anuncios: 0,
      investido: 0,
      impressoes: 0,
      cliques: 0,
      leads: 0,
      desqualificados: 0,
      vendas: 0,
      recebido: 0,
    };
    c.anuncios += 1;
    c.investido += x.investido;
    c.impressoes += x.impressoes;
    c.cliques += x.cliques;
    c.leads += x.leads;
    c.desqualificados += x.desqualificados;
    c.vendas += x.vendas;
    c.recebido += x.recebido;
    conjuntos.set(chave, c);
  }

  return ok(
    {
      de: de.data,
      ate: ate.data,
      anterior,
      dias,
      totais: somarDias_(dias),
      totaisAnterior: somarDias_(diasAnteriores),
      campanhas,
      // Do Meta por anúncio (com campanha e conjunto); sem base do Meta, cai nos criativos.
      anuncios:
        anunciosDoMeta.length > 0
          ? anunciosDoMeta
          : agrupar("demand_creative_id", nomesDeCriativo).map((c) => ({
              id: c.id,
              nome: c.nome,
              campanha: "",
              conjuntoId: "",
              conjunto: "",
              investido: 0,
              impressoes: 0,
              cliques: 0,
              viewsLP: 0,
              leads: c.leads,
              desqualificados: c.desqualificados,
              vendas: c.vendas,
              recebido: c.recebido,
            })),
      conjuntos: [...conjuntos.values()]
        .map((c) => ({ ...c, investido: arredonda(c.investido), recebido: arredonda(c.recebido) }))
        .sort((x, y) => y.investido - x.investido),
      paginas: agrupar("demand_landing_page_id", nomesDePagina),
      catalogo: catalogo.map((c) => ({ id: c.id, nome: c.name })),
    },
    { requestId: a.requestId },
  );
}
