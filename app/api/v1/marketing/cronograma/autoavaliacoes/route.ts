/**
 * GET /api/v1/marketing/cronograma/autoavaliacoes — o histórico das autoavaliações semanais
 * (mais recentes primeiro). PUT — grava a da semana (nota 0–100 + anotações); uma por semana.
 * Só a agência (manager+): o cliente nunca vê.
 */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autoavaliacaoSchema, COLUNAS_DA_AUTOAVALIACAO } from "@/lib/marketing/autoavaliacao";
import { domingoDe } from "@/lib/marketing/cronograma";
import { autorizarCronograma } from "@/lib/marketing/cronograma-servidor";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const a = await autorizarCronograma("manager", false);
  if (!a.ok) return a.response;
  const { data, error } = await a.supabase
    .from("marketing_cronograma_autoavaliacoes")
    .select(COLUNAS_DA_AUTOAVALIACAO)
    .eq("organization_id", a.orgId)
    .order("semana_inicio", { ascending: false })
    .limit(104);
  if (error)
    return fail("internal_error", a.t("Erro ao carregar as autoavaliações."), 500, {
      requestId: a.requestId,
    });
  return ok({ autoavaliacoes: data ?? [] }, { requestId: a.requestId });
}

export async function PUT(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCronograma("manager", true);
  if (!a.ok) return a.response;
  const corpo = autoavaliacaoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success)
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  const semana = domingoDe(corpo.data.semana_inicio);
  const { data, error } = await a.supabase
    .from("marketing_cronograma_autoavaliacoes")
    .upsert(
      {
        organization_id: a.orgId,
        semana_inicio: semana,
        nota: corpo.data.nota,
        anotacoes: corpo.data.anotacoes.trim(),
        updated_by: a.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,semana_inicio" },
    )
    .select(COLUNAS_DA_AUTOAVALIACAO)
    .single();
  if (error)
    return fail("internal_error", a.t("Erro ao salvar a autoavaliação."), 500, {
      requestId: a.requestId,
    });
  await audit({
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: "marketing_cronograma.self_review_saved",
    resourceType: "marketing_cronograma",
    resourceId: null,
    requestId: a.requestId,
    metadata: { semana_inicio: semana, nota: corpo.data.nota },
  });
  return ok({ autoavaliacao: data }, { requestId: a.requestId });
}
