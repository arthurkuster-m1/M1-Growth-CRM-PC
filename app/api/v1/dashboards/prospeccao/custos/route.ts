/**
 * GET  /api/v1/dashboards/prospeccao/custos?de=&ate= — os custos de captação lançados no período.
 * POST /api/v1/dashboards/prospeccao/custos — lança quanto a captação de uma fonte custou
 * (extração, importação…). `campaign_id` vazio vale para todas as campanhas; quando só vem o
 * `funil_id` (importação), a campanha é a dona daquele funil, se houver.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const COLUNAS = "id, campaign_id, source, day, amount_cents, note, created_at";

const corpoSchema = z.object({
  source: z.string().trim().min(1).max(60),
  /** Em reais. */
  amount: z.number().positive().max(100_000_000),
  day: dia.optional(),
  note: z.string().trim().max(300).optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  funil_id: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const q = req.nextUrl.searchParams;
  const de = dia.safeParse(q.get("de"));
  const ate = dia.safeParse(q.get("ate"));
  if (!de.success || !ate.success) {
    return fail("validation_failed", a.t("Período inválido."), 422, { requestId: a.requestId });
  }
  const { data, error } = await a.supabase
    .from("lead_source_costs")
    .select(COLUNAS)
    .eq("organization_id", a.orgId)
    .gte("day", de.data)
    .lte("day", ate.data)
    .order("day", { ascending: false })
    .limit(500);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar os custos."), 500, {
      requestId: a.requestId,
    });
  }
  return ok({ custos: data ?? [] }, { requestId: a.requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  let campanhaId: string | null = corpo.data.campaign_id ?? null;
  if (campanhaId) {
    const { data } = await a.supabase
      .from("demand_campaigns")
      .select("id")
      .eq("id", campanhaId)
      .eq("organization_id", a.orgId)
      .maybeSingle();
    if (!data)
      return fail("not_found", a.t("Campanha não encontrada."), 404, { requestId: a.requestId });
  } else if (corpo.data.funil_id) {
    const { data } = await a.supabase
      .from("demand_campaigns")
      .select("id")
      .eq("organization_id", a.orgId)
      .eq("pipeline_id", corpo.data.funil_id)
      .limit(1)
      .maybeSingle();
    campanhaId = (data as { id: string } | null)?.id ?? null;
  }
  const { data, error } = await a.supabase
    .from("lead_source_costs")
    .insert({
      organization_id: a.orgId,
      campaign_id: campanhaId,
      source: corpo.data.source,
      amount_cents: Math.round(corpo.data.amount * 100),
      ...(corpo.data.day ? { day: corpo.data.day } : {}),
      note: corpo.data.note ?? "",
      created_by: a.userId,
    })
    .select(COLUNAS)
    .single();
  if (error || !data) {
    return fail("internal_error", a.t("Erro ao salvar o custo."), 500, { requestId: a.requestId });
  }
  await audit({
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: "lead_source_cost.created",
    resourceType: "lead_source_costs",
    resourceId: (data as { id: string }).id,
    requestId: a.requestId,
    metadata: { source: corpo.data.source, amount: corpo.data.amount },
  });
  return ok({ custo: data }, { requestId: a.requestId, status: 201 });
}
