/**
 * GET /api/v1/demand-campaigns/resultados?periodo=<mes|mes_passado|semana|...>
 *
 * Os resultados de CADA campanha num período, com os números reais: investido (Meta), leads (CRM),
 * vendas fechadas, faturamento recebido e a receber. É o mesmo cálculo das metas automáticas.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { CANAIS_DA_CAMPANHA } from "@/lib/marketing/campanhas";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import { PERIODOS, janelaDoPeriodo } from "@/lib/marketing/periodos";
import { crmDaCampanhaPorDia } from "@/lib/marketing/crm-por-dia";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  periodo: z.enum(PERIODOS).default("mes"),
  de: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  ate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Só estas campanhas (ids separados por vírgula). */
  campanhas: z.string().optional(),
  /** Só estes canais (separados por vírgula). */
  canais: z.string().optional(),
});

const lista = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const q = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) {
    return fail("validation_failed", a.t("Parâmetros inválidos."), 422, { requestId: a.requestId });
  }
  const { data: org } = await a.supabase
    .from("organizations")
    .select("timezone")
    .eq("id", a.orgId)
    .maybeSingle();
  const fuso = (org?.timezone as string | null) || "America/Sao_Paulo";
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date());
  const janela =
    q.data.de && q.data.ate && q.data.de <= q.data.ate
      ? { de: q.data.de, ate: q.data.ate }
      : janelaDoPeriodo(q.data.periodo, hoje);

  const { data, error } = await a.supabase.rpc("fn_demand_campaigns_resultados", {
    p_org: a.orgId,
    p_from: janela.de,
    p_to: janela.ate,
    p_tz: fuso,
  });
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar os resultados."), 500, {
      requestId: a.requestId,
    });
  }
  const { data: campanhas } = await a.supabase
    .from("demand_campaigns")
    .select(
      "id, name, channel, status, goal_leads, goal_sales, goal_revenue, goal_cpl, goal_period, pipeline_id",
    )
    .eq("organization_id", a.orgId)
    .limit(500);
  const porId = new Map((campanhas ?? []).map((c) => [c.id as string, c]));
  const idsPedidos = new Set(lista(q.data.campanhas));
  const canaisPedidos = new Set(
    lista(q.data.canais).filter((c) => (CANAIS_DA_CAMPANHA as readonly string[]).includes(c)),
  );
  const todasAsLinhas = (
    (data ?? []) as Array<{
      campaign_id: string;
      investido: number | string;
      leads: number;
      vendas: number;
      recebido: number | string;
      a_receber: number | string;
    }>
  ).map((r) => {
    const c = porId.get(r.campaign_id);
    return {
      id: r.campaign_id,
      name: (c?.name as string | undefined) ?? "—",
      channel: (c?.channel as string | undefined) ?? "",
      status: (c?.status as string | undefined) ?? "",
      goal_leads: (c?.goal_leads as number | null) ?? null,
      goal_sales: (c?.goal_sales as number | null) ?? null,
      goal_revenue:
        c?.goal_revenue === null || c?.goal_revenue === undefined ? null : Number(c.goal_revenue),
      goal_cpl: c?.goal_cpl === null || c?.goal_cpl === undefined ? null : Number(c.goal_cpl),
      investido: Number(r.investido) || 0,
      leads: Number(r.leads) || 0,
      vendas: Number(r.vendas) || 0,
      recebido: (Number(r.recebido) || 0) / 100,
      a_receber: (Number(r.a_receber) || 0) / 100,
    };
  });
  const catalogo = todasAsLinhas
    .map((l) => ({ id: l.id, name: l.name, channel: l.channel }))
    .sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
  const linhas = todasAsLinhas.filter(
    (l) =>
      (idsPedidos.size === 0 || idsPedidos.has(l.id)) &&
      (canaisPedidos.size === 0 || canaisPedidos.has(l.channel)),
  );

  // Os números de anúncio e os do CRM que não vêm da função do banco: impressões, cliques, visitas,
  // faturamento (vendas fechadas) e reuniões — para as colunas escolhidas na tela.
  const campanhasDoFunil = (campanhas ?? []).map((c) => ({
    id: c.id as string,
    pipeline_id: (c.pipeline_id as string | null) ?? null,
  }));
  const extras = new Map<
    string,
    {
      impressoes: number;
      cliques: number;
      visitas: number;
      faturamento: number;
      agendamentos: number;
      reunioes: number;
    }
  >();
  if (linhas.length > 0) {
    const { data: dias } = await a.supabase
      .from("demand_campaign_days")
      .select("campaign_id, impressions, link_clicks, lp_views")
      .eq("organization_id", a.orgId)
      .in("campaign_id", linhas.map((l) => l.id))
      .gte("day", janela.de)
      .lte("day", janela.ate)
      .limit(20000);
    for (const d of (dias ?? []) as Array<{
      campaign_id: string;
      impressions: number;
      link_clicks: number;
      lp_views: number;
    }>) {
      const e = extras.get(d.campaign_id) ?? {
        impressoes: 0,
        cliques: 0,
        visitas: 0,
        faturamento: 0,
        agendamentos: 0,
        reunioes: 0,
      };
      e.impressoes += Number(d.impressions) || 0;
      e.cliques += Number(d.link_clicks) || 0;
      e.visitas += Number(d.lp_views) || 0;
      extras.set(d.campaign_id, e);
    }
    for (let i = 0; i < linhas.length; i += 5) {
      await Promise.all(
        linhas.slice(i, i + 5).map(async (l) => {
          const pipeline = campanhasDoFunil.find((c) => c.id === l.id)?.pipeline_id ?? null;
          const porDia = await crmDaCampanhaPorDia(
            a.supabase,
            a.orgId,
            l.id,
            pipeline,
            campanhasDoFunil,
            fuso,
          );
          const e = extras.get(l.id) ?? {
            impressoes: 0,
            cliques: 0,
            visitas: 0,
            faturamento: 0,
            agendamentos: 0,
            reunioes: 0,
          };
          for (const [dia, v] of porDia) {
            if (dia < janela.de || dia > janela.ate) continue;
            e.faturamento += v.faturamento;
            e.agendamentos += v.agendamentos;
            e.reunioes += v.reunioes;
          }
          extras.set(l.id, e);
        }),
      );
    }
  }
  const linhasCompletas = linhas.map((l) => ({
    ...l,
    impressoes: extras.get(l.id)?.impressoes ?? 0,
    cliques: extras.get(l.id)?.cliques ?? 0,
    visitas: extras.get(l.id)?.visitas ?? 0,
    faturamento: extras.get(l.id)?.faturamento ?? 0,
    agendamentos: extras.get(l.id)?.agendamentos ?? 0,
    reunioes: extras.get(l.id)?.reunioes ?? 0,
  }));

  // Cada pessoa conta UMA vez no total, mesmo que esteja em mais de uma campanha.
  let leadsUnicos = 0;
  if (linhas.length > 0) {
    const { data: unicos } = await a.supabase.rpc("fn_demand_leads_unicos", {
      p_org: a.orgId,
      p_from: janela.de,
      p_to: janela.ate,
      p_tz: fuso,
      p_campaigns: linhas.map((l) => l.id),
    });
    leadsUnicos = Number(unicos) || 0;
  }
  return ok(
    { de: janela.de, ate: janela.ate, linhas: linhasCompletas, catalogo, leads_unicos: leadsUnicos },
    { requestId: a.requestId },
  );
}
