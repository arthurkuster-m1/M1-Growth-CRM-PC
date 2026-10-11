/**
 * GET  /api/v1/demand-campaigns — as campanhas de demanda da empresa (toda a empresa lê), com os
 *      funis (para o seletor) e, para a agência, a última análise e o último planejamento.
 * POST /api/v1/demand-campaigns — cria uma campanha (manager+).
 */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  COLUNAS_DA_CAMPANHA,
  campanhaDaLinha,
  novaCampanhaSchema,
  type CampanhaDeDemanda,
} from "@/lib/marketing/campanhas";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";

const LIMITE = 500;

export async function GET(): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const [{ data, error }, { data: funis }, { data: membros }] = await Promise.all([
    a.supabase
      .from("demand_campaigns")
      .select(COLUNAS_DA_CAMPANHA)
      .eq("organization_id", a.orgId)
      .order("position", { ascending: true })
      .limit(LIMITE),
    a.supabase
      .from("crm_pipelines")
      .select("id, name")
      .eq("organization_id", a.orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    a.supabase
      .from("user_organizations")
      .select("user_id, role")
      .eq("organization_id", a.orgId)
      .is("revoked_at", null)
      .limit(200),
  ]);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar as campanhas."), 500, {
      requestId: a.requestId,
    });
  }
  const campanhas = ((data ?? []) as Array<Record<string, unknown>>).map(campanhaDaLinha);

  // A última análise e o último planejamento de cada campanha (só quem é da agência as lê: a
  // RLS das notas já esconde o resto, e o cliente recebe `null`).
  if (a.podeEditar && campanhas.length > 0) {
    const { data: notas } = await a.supabase
      .from("demand_campaign_notes")
      .select("campaign_id, kind, note_date, body")
      .eq("organization_id", a.orgId)
      .in("kind", ["analise", "planejamento"])
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3000);
    const ultimas = new Map<string, { data: string; texto: string }>();
    for (const n of (notas ?? []) as Array<{
      campaign_id: string;
      kind: string;
      note_date: string;
      body: string;
    }>) {
      const chave = `${n.campaign_id}:${n.kind}`;
      if (!ultimas.has(chave)) ultimas.set(chave, { data: n.note_date, texto: n.body });
    }
    for (const c of campanhas as CampanhaDeDemanda[]) {
      c.ultima_analise = ultimas.get(`${c.id}:analise`) ?? null;
      c.ultimo_planejamento = ultimas.get(`${c.id}:planejamento`) ?? null;
    }
  }

  return ok(
    {
      campanhas,
      funis: (funis ?? []) as Array<{ id: string; name: string }>,
      equipe: ((membros ?? []) as Array<{ user_id: string }>).map((m) => m.user_id),
      pode_editar: a.podeEditar,
    },
    { requestId: a.requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const corpo = novaCampanhaSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { count } = await a.supabase
    .from("demand_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", a.orgId);
  if ((count ?? 0) >= LIMITE) {
    return fail("validation_failed", a.t("O limite é de 500 campanhas."), 422, {
      requestId: a.requestId,
    });
  }
  const { data, error } = await a.supabase
    .from("demand_campaigns")
    .insert({ organization_id: a.orgId, created_by: a.userId, ...corpo.data })
    .select(COLUNAS_DA_CAMPANHA)
    .single();
  if (error || !data) {
    return fail("internal_error", a.t("Erro ao criar a campanha."), 500, {
      requestId: a.requestId,
    });
  }
  const campanha = campanhaDaLinha(data as Record<string, unknown>);
  await audit({
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: "demand_campaign.created",
    resourceType: "demand_campaigns",
    resourceId: campanha.id,
    requestId: a.requestId,
    metadata: { name: campanha.name, channel: campanha.channel },
  });
  return ok({ campanha }, { requestId: a.requestId, status: 201 });
}
