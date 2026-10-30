/**
 * GET  /api/v1/demand-funnel-templates — os modelos de funil da empresa (manager+).
 * POST /api/v1/demand-funnel-templates — salva as etapas de um funil como modelo (manager+).
 */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import {
  COLUNAS_DO_MODELO,
  etapasDoModelo,
  novoModeloSchema,
  type EtapaDoModelo,
} from "@/lib/marketing/modelos-de-funil";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const a = await autorizarCampanhas("manager", false);
  if (!a.ok) return a.response;
  const { data, error } = await a.supabase
    .from("demand_funnel_templates")
    .select(COLUNAS_DO_MODELO)
    .eq("organization_id", a.orgId)
    .order("name", { ascending: true })
    .limit(200);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar os modelos de funil."), 500, {
      requestId: a.requestId,
    });
  }
  return ok(
    {
      modelos: (data ?? []).map((m) => ({
        id: m.id as string,
        name: m.name as string,
        stages: etapasDoModelo(m.stages),
        created_at: m.created_at as string,
      })),
    },
    { requestId: a.requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const corpo = novoModeloSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { data: etapas, error: erroEtapas } = await a.supabase
    .from("crm_stages")
    .select("name, slug, color, is_won, is_lost, win_probability, expected_duration_hours, qualification")
    .eq("organization_id", a.orgId)
    .eq("pipeline_id", corpo.data.from_pipeline_id)
    .eq("is_archived", false)
    .order("position", { ascending: true });
  if (erroEtapas || !etapas || etapas.length === 0) {
    return fail("not_found", a.t("Funil não encontrado."), 404, { requestId: a.requestId });
  }
  const stages: EtapaDoModelo[] = etapas.map((e) => ({
    name: e.name as string,
    is_won: e.is_won === true,
    is_lost: e.is_lost === true,
    win_probability: e.win_probability === null ? null : Number(e.win_probability),
    expected_duration_hours:
      e.expected_duration_hours === null ? null : Math.round(Number(e.expected_duration_hours)),
    qualification: (e.qualification as "mql" | "disqualified" | null) ?? null,
    ...(typeof e.color === "string" && /^#[0-9a-fA-F]{6}$/.test(e.color) ? { color: e.color } : {}),
    // Guarda o slug: o funil criado do modelo mantém as etapas ligadas à Agenda.
    ...(typeof e.slug === "string" && /^[a-z0-9_-]{2,40}$/.test(e.slug) ? { slug: e.slug } : {}),
  }));
  const { data, error } = await a.supabase
    .from("demand_funnel_templates")
    .insert({
      organization_id: a.orgId,
      name: corpo.data.name,
      stages,
      created_by: a.userId,
    })
    .select(COLUNAS_DO_MODELO)
    .single();
  if (error || !data) {
    const duplicado = (error as { code?: string } | null)?.code === "23505";
    return fail(
      duplicado ? "validation_failed" : "internal_error",
      duplicado ? a.t("Já existe um modelo com esse nome.") : a.t("Erro ao salvar o modelo."),
      duplicado ? 422 : 500,
      { requestId: a.requestId },
    );
  }
  return ok(
    {
      modelo: {
        id: data.id as string,
        name: data.name as string,
        stages: etapasDoModelo(data.stages),
        created_at: data.created_at as string,
      },
    },
    { requestId: a.requestId, status: 201 },
  );
}
