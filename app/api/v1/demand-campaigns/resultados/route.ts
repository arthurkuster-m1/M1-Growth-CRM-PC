/**
 * GET /api/v1/demand-campaigns/resultados?periodo=<mes|mes_passado|semana|...>
 *
 * Os resultados de CADA campanha num período, com os números reais: investido (Meta), leads (CRM),
 * vendas fechadas, faturamento recebido e a receber. É o mesmo cálculo das metas automáticas.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import { PERIODOS, janelaDoPeriodo } from "@/lib/marketing/periodos";

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
});

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
      "id, name, channel, status, goal_leads, goal_sales, goal_revenue, goal_cpl, goal_period",
    )
    .eq("organization_id", a.orgId)
    .limit(500);
  const porId = new Map((campanhas ?? []).map((c) => [c.id as string, c]));
  const linhas = (
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
  return ok({ de: janela.de, ate: janela.ate, linhas }, { requestId: a.requestId });
}
