/**
 * GET  /api/v1/demand-creative-templates — os modelos de criativo da empresa (todo membro lê).
 * POST /api/v1/demand-creative-templates — novo modelo (manager+).
 */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import {
  COLUNAS_DO_MODELO,
  modeloDaLinha,
  novoModeloSchema,
} from "@/lib/marketing/modelos-de-criativo";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { data, error } = await a.supabase
    .from("demand_creative_templates")
    .select(COLUNAS_DO_MODELO)
    .eq("organization_id", a.orgId)
    .order("position", { ascending: true })
    .limit(200);
  if (error) {
    return fail("internal_error", a.t("Erro ao carregar os modelos."), 500, {
      requestId: a.requestId,
    });
  }
  return ok(
    { modelos: (data ?? []).map((l) => modeloDaLinha(l as unknown as Record<string, unknown>)) },
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
  const { data, error } = await a.supabase
    .from("demand_creative_templates")
    .insert({ ...corpo.data, organization_id: a.orgId, created_by: a.userId })
    .select(COLUNAS_DO_MODELO)
    .single();
  if (error || !data) {
    return fail("internal_error", a.t("Erro ao salvar o modelo."), 500, { requestId: a.requestId });
  }
  return ok(
    { modelo: modeloDaLinha(data as unknown as Record<string, unknown>) },
    { requestId: a.requestId, status: 201 },
  );
}
