/**
 * GET /api/v1/dashboards/prospeccao?de=&ate=&campanhas=id,id — a base do dashboard de Prospecção
 * Ativa. Tudo sai do CRM: os leads das campanhas de prospecção (com a FONTE gravada na origem),
 * as abordagens registradas nas oportunidades (ligação, mensagem, e-mail — cada uma com resultado),
 * os disparos de campanha feitos a esses contatos, as reuniões e as parcelas recebidas.
 *
 * Devolve EVENTOS normalizados dos dois períodos (o pedido e o anterior, do mesmo tamanho); as
 * contas moram em `lib/dashboards/prospeccao.ts` e rodam na tela. Toda a empresa lê (viewer+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { diaNoFuso, investimentoDoDia } from "@/lib/marketing/dia-a-dia-automatico";
import {
  classificarResultado,
  type CustoDeCaptacao,
  diasDoRecorte,
  recorteAnterior,
  type Interacao,
  type LeadCaptado,
  type PagamentoDoLead,
  type ReuniaoDoLead,
  type TipoDeContato,
  type VendaDoLead,
} from "@/lib/dashboards/prospeccao";
import { dolarEmReais, resolverCambio, type Cambio } from "@/lib/dashboards/cambio";
import { createAdminClient } from "@/lib/supabase/admin";
import { campanhaDaOportunidade, type CampanhaDoFunil } from "@/lib/marketing/atribuicao";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const LOTE = 150;

const FONTES_TECNICAS: Record<string, string> = {
  manual: "Cadastro manual",
  importacao_planilha: "Importação de planilha",
  import_csv: "Importação de planilha",
  webhook: "Integração",
  api: "Integração",
  mcp: "Integração",
  whatsapp_inbound: "WhatsApp (entrada)",
  inbound: "WhatsApp (entrada)",
};

/** De onde o lead veio: a origem escolhida na ficha/importação, ou o `source` técnico traduzido. */
function fonteDoLead(source: string | null, meta: Record<string, unknown> | null): string {
  const manual = (meta?.origem_manual as { origem?: unknown } | undefined)?.origem;
  if (typeof manual === "string" && manual.trim()) return manual.trim().slice(0, 60);
  const bruta = (source ?? "").trim();
  if (!bruta) return "Sem fonte";
  return FONTES_TECNICAS[bruta.toLowerCase()] ?? bruta.slice(0, 60);
}

/** Uma extração (busca de leads) com o custo que o provedor cobrou, já em reais. */
interface ExtracaoComCusto {
  id: string;
  nome: string;
  dia: string;
  usd: number;
  brl: number | null;
}

const FONTE_DA_EXTRACAO = "Extração de leads";
const STATUS_DE_ENVIO = ["sent", "delivered", "read", "replied"];

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const q = req.nextUrl.searchParams;
  const de = dia.safeParse(q.get("de"));
  const ate = dia.safeParse(q.get("ate"));
  if (!de.success || !ate.success || de.data > ate.data) {
    return fail("validation_failed", a.t("Período inválido."), 422, { requestId: a.requestId });
  }
  const anterior = recorteAnterior({ de: de.data, ate: ate.data });
  const pedidas = (q.get("campanhas") ?? "")
    .split(",")
    .filter((v) => z.string().uuid().safeParse(v).success);

  const { data: org } = await a.supabase
    .from("organizations")
    .select("timezone")
    .eq("id", a.orgId)
    .maybeSingle();
  const fuso = (org?.timezone as string | null) || "America/Sao_Paulo";
  const hoje = diaNoFuso(new Date().toISOString(), fuso);

  const { data: catalogoBruto, error: erroCatalogo } = await a.supabase
    .from("demand_campaigns")
    .select("id, name, pipeline_id, budget, budget_period, start_date, end_date")
    .eq("organization_id", a.orgId)
    .eq("channel", "prospeccao")
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
    pipeline_id: string | null;
    budget: number | null;
    budget_period: "total" | "diario" | "semanal" | "mensal";
    start_date: string | null;
    end_date: string | null;
  }>;
  const escolhidas = catalogo.filter((c) => pedidas.length === 0 || pedidas.includes(c.id));
  const ids = escolhidas.map((c) => c.id);
  const vazio = {
    de: de.data,
    ate: ate.data,
    anterior,
    leads: [] as LeadCaptado[],
    interacoes: [] as Interacao[],
    reunioes: [] as ReuniaoDoLead[],
    vendas: [] as VendaDoLead[],
    pagamentos: [] as PagamentoDoLead[],
    investimentoPorDia: {} as Record<string, number>,
    custos: [] as CustoDeCaptacao[],
    extracoes: [] as ExtracaoComCusto[],
    cambio: { taxa: null, origem: "indisponivel", iofPct: 3.5 } as Cambio,
    abordagens: [] as Array<{ id: string; nome: string; meio: string; campanha: string }>,
    catalogo: catalogo.map((c) => ({ id: c.id, nome: c.name })),
    semResultado: 0,
  };
  if (ids.length === 0) return ok(vazio, { requestId: a.requestId });

  // De quem é cada oportunidade (a mesma regra do resto do produto).
  const { data: todas } = await a.supabase
    .from("demand_campaigns")
    .select("id, pipeline_id")
    .eq("organization_id", a.orgId)
    .limit(1000);
  const campanhasDoFunil = (todas ?? []) as CampanhaDoFunil[];
  const funis = campanhasDoFunil
    .filter((c) => ids.includes(c.id) && c.pipeline_id)
    .map((c) => c.pipeline_id as string);
  const filtroDeDonas = [
    ...(funis.length > 0 ? [`pipeline_id.in.(${funis.join(",")})`] : []),
    `demand_campaign_id.in.(${ids.join(",")})`,
  ].join(",");

  const { data: oportunidades } = await a.supabase
    .from("crm_leads")
    .select("id, contact_id, pipeline_id, demand_campaign_id, source, source_metadata, created_at")
    .eq("organization_id", a.orgId)
    .or(filtroDeDonas)
    .limit(5000);
  const doGrupo = (
    (oportunidades ?? []) as Array<{
      id: string;
      contact_id: string | null;
      pipeline_id: string | null;
      demand_campaign_id: string | null;
      source: string | null;
      source_metadata: Record<string, unknown> | null;
      created_at: string;
    }>
  ).filter((o) => {
    const dona = campanhaDaOportunidade(o, campanhasDoFunil);
    return dona !== null && ids.includes(dona);
  });
  const idsDosLeads = doGrupo.map((o) => o.id);
  const leadDoContato = new Map<string, string>();
  for (const o of doGrupo)
    if (o.contact_id && !leadDoContato.has(o.contact_id)) leadDoContato.set(o.contact_id, o.id);

  const janelaDe = anterior.de;
  const leads: LeadCaptado[] = doGrupo
    .map((o) => ({
      id: o.id,
      dia: diaNoFuso(o.created_at, fuso),
      fonte: fonteDoLead(o.source, o.source_metadata),
    }))
    .filter((l) => l.dia >= janelaDe && l.dia <= ate.data);

  // Abordagens e reuniões registradas nas oportunidades.
  const interacoes: Interacao[] = [];
  const reunioes: ReuniaoDoLead[] = [];
  let semResultado = 0;
  const inicioIso = `${janelaDe}T00:00:00-03:00`;
  for (let i = 0; i < idsDosLeads.length; i += LOTE) {
    const { data } = await a.supabase
      .from("crm_lead_activities")
      .select("lead_id, type, payload, performed_at")
      .eq("organization_id", a.orgId)
      .in("lead_id", idsDosLeads.slice(i, i + LOTE))
      .in("type", ["note", "appointment_scheduled", "appointment_completed"])
      .gte("performed_at", inicioIso)
      .limit(10000);
    for (const at of (data ?? []) as Array<{
      lead_id: string;
      type: string;
      payload: Record<string, unknown> | null;
      performed_at: string;
    }>) {
      const d = diaNoFuso(at.performed_at, fuso);
      if (d < janelaDe || d > ate.data) continue;
      if (at.type === "appointment_scheduled") {
        reunioes.push({ dia: d, leadId: at.lead_id, tipo: "agendada" });
        continue;
      }
      if (at.type === "appointment_completed") {
        reunioes.push({ dia: d, leadId: at.lead_id, tipo: "feita" });
        continue;
      }
      const acao = typeof at.payload?.acao === "string" ? at.payload.acao : "";
      if (acao === "reuniao") {
        reunioes.push({ dia: d, leadId: at.lead_id, tipo: "feita" });
        continue;
      }
      if (acao !== "ligacao" && acao !== "mensagem" && acao !== "email" && acao !== "nao_atendeu")
        continue;
      const resultadoBruto =
        typeof at.payload?.resultado === "string"
          ? at.payload.resultado
          : acao === "nao_atendeu"
            ? "Não atendeu"
            : "";
      if (!resultadoBruto.trim()) semResultado += 1;
      const { contato, decisor } = classificarResultado(resultadoBruto);
      const tipo: TipoDeContato =
        acao === "email" ? "email" : acao === "mensagem" ? "mensagem_manual" : "ligacao";
      interacoes.push({
        dia: d,
        leadId: at.lead_id,
        tipo,
        abordagemId: typeof at.payload?.abordagem_id === "string" ? at.payload.abordagem_id : null,
        contato,
        decisor,
      });
    }
  }

  // Disparos de campanha feitos a esses contatos (o resultado é o estado do envio: respondeu ou não).
  const idsDeContatos = [...leadDoContato.keys()];
  const destinatarios: Array<{
    contact_id: string;
    campaign_id: string;
    sent_at: string;
    replied_at: string | null;
  }> = [];
  for (let i = 0; i < idsDeContatos.length; i += LOTE) {
    const { data } = await a.supabase
      .from("campaign_recipients")
      .select("contact_id, campaign_id, sent_at, replied_at")
      .eq("organization_id", a.orgId)
      .in("contact_id", idsDeContatos.slice(i, i + LOTE))
      .in("status", STATUS_DE_ENVIO)
      .not("sent_at", "is", null)
      .gte("sent_at", inicioIso)
      .limit(10000);
    destinatarios.push(...((data ?? []) as typeof destinatarios));
  }
  if (destinatarios.length > 0) {
    const idsDeCampanhas = [...new Set(destinatarios.map((d) => d.campaign_id))];
    const { data: disparos } = await a.supabase
      .from("campaigns")
      .select("id, channel_session_id")
      .eq("organization_id", a.orgId)
      .in("id", idsDeCampanhas);
    const sessaoDoDisparo = new Map(
      ((disparos ?? []) as Array<{ id: string; channel_session_id: string }>).map((d) => [
        d.id,
        d.channel_session_id,
      ]),
    );
    const { data: sessoes } = await a.supabase
      .from("channel_sessions")
      .select("id, provider")
      .eq("organization_id", a.orgId)
      .in("id", [...new Set(sessaoDoDisparo.values())]);
    const provedor = new Map(
      ((sessoes ?? []) as Array<{ id: string; provider: string }>).map((s) => [s.id, s.provider]),
    );
    for (const d of destinatarios) {
      const leadId = leadDoContato.get(d.contact_id);
      const diaEnvio = diaNoFuso(d.sent_at, fuso);
      if (!leadId || diaEnvio < janelaDe || diaEnvio > ate.data) continue;
      const oficial = provedor.get(sessaoDoDisparo.get(d.campaign_id) ?? "") === "meta_cloud";
      interacoes.push({
        dia: diaEnvio,
        leadId,
        tipo: oficial ? "whatsapp_oficial" : "whatsapp_nao_oficial",
        abordagemId: null,
        contato: d.replied_at !== null,
        decisor: false,
      });
    }
  }

  // Vendas (dia da 1ª parcela recebida) e dinheiro recebido.
  const vendas: VendaDoLead[] = [];
  const pagamentos: PagamentoDoLead[] = [];
  const primeira = new Map<string, string>();
  for (let i = 0; i < idsDosLeads.length; i += 200) {
    const { data } = await a.supabase
      .from("crm_sale_payments")
      .select("lead_id, paid_on, amount_cents")
      .eq("organization_id", a.orgId)
      .eq("status", "recebida")
      .lte("paid_on", ate.data)
      .in("lead_id", idsDosLeads.slice(i, i + 200))
      .limit(20000);
    for (const p of (data ?? []) as Array<{
      lead_id: string;
      paid_on: string | null;
      amount_cents: number | string;
    }>) {
      if (!p.paid_on) continue;
      const d = String(p.paid_on).slice(0, 10);
      const atual = primeira.get(p.lead_id);
      if (!atual || d < atual) primeira.set(p.lead_id, d);
      if (d >= janelaDe)
        pagamentos.push({ leadId: p.lead_id, dia: d, valor: Number(p.amount_cents) / 100 });
    }
  }
  for (const [leadId, d] of primeira) if (d >= janelaDe) vendas.push({ leadId, dia: d });

  // O investimento: o orçamento das campanhas, dia a dia.
  const investimentoPorDia: Record<string, number> = {};
  for (const d of diasDoRecorte({ de: janelaDe, ate: ate.data })) {
    let soma = 0;
    for (const c of escolhidas) soma += investimentoDoDia(c, d, hoje) ?? 0;
    if (soma > 0) investimentoPorDia[d] = Math.round(soma * 100) / 100;
  }

  // Custos de captação lançados (por fonte): os de uma campanha escolhida e os de "todas".
  const { data: custosBrutos } = await a.supabase
    .from("lead_source_costs")
    .select("campaign_id, source, day, amount_cents")
    .eq("organization_id", a.orgId)
    .gte("day", janelaDe)
    .lte("day", ate.data)
    .limit(2000);
  const custos: CustoDeCaptacao[] = (
    (custosBrutos ?? []) as Array<{
      campaign_id: string | null;
      source: string;
      day: string;
      amount_cents: number | string;
    }>
  )
    .filter((c) => c.campaign_id === null || ids.includes(c.campaign_id))
    .map((c) => ({
      dia: String(c.day).slice(0, 10),
      fonte: c.source,
      valor: Number(c.amount_cents) / 100,
    }));

  // O custo das extrações: cobrado em dólar, convertido com a cotação do dia e o IOF.
  const { data: orgCfg } = await a.supabase
    .from("organizations")
    .select("settings")
    .eq("id", a.orgId)
    .maybeSingle();
  const cambio = await resolverCambio(orgCfg?.settings);
  const { data: extracoesBrutas } = await createAdminClient()
    .from("prospecting_campaigns")
    .select("id, name, cost_usd, config, created_at")
    .eq("organization_id", a.orgId)
    .eq("search_status", "succeeded")
    .not("cost_usd", "is", null)
    .limit(500);
  const extracoes: ExtracaoComCusto[] = [];
  for (const e of (extracoesBrutas ?? []) as Array<{
    id: string;
    name: string;
    cost_usd: number | string;
    config: { pipeline_id?: string } | null;
    created_at: string;
  }>) {
    const d = diaNoFuso(e.created_at, fuso);
    if (d < janelaDe || d > ate.data) continue;
    // A extração é da campanha dona do funil dela; sem dona, vale para todas.
    const dona = e.config?.pipeline_id
      ? catalogo.find((c) => c.pipeline_id === e.config?.pipeline_id)
      : undefined;
    if (dona && !ids.includes(dona.id)) continue;
    const usd = Number(e.cost_usd);
    if (!Number.isFinite(usd) || usd <= 0) continue;
    const brl = dolarEmReais(usd, cambio);
    extracoes.push({ id: e.id, nome: e.name, dia: d, usd, brl });
    if (brl !== null) custos.push({ dia: d, fonte: FONTE_DA_EXTRACAO, valor: brl });
  }

  const { data: abordagens } = await a.supabase
    .from("demand_campaign_approaches")
    .select("id, name, medium, campaign_id")
    .eq("organization_id", a.orgId)
    .in("campaign_id", ids)
    .limit(2000);
  const nomeDaCampanha = new Map(escolhidas.map((c) => [c.id, c.name]));

  return ok(
    {
      ...vazio,
      leads,
      interacoes,
      reunioes,
      vendas,
      pagamentos,
      investimentoPorDia,
      custos,
      extracoes,
      cambio,
      semResultado,
      abordagens: (
        (abordagens ?? []) as Array<{
          id: string;
          name: string;
          medium: string;
          campaign_id: string;
        }>
      ).map((x) => ({
        id: x.id,
        nome: x.name,
        meio: x.medium,
        campanha: nomeDaCampanha.get(x.campaign_id) ?? "",
      })),
    },
    { requestId: a.requestId },
  );
}
