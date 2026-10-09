import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET  /api/v1/saved-views?screen=tarefas — as visualizações salvas da tela.
 * POST /api/v1/saved-views — cria uma visualização (aba).
 *
 * As abas das telas estilo Notion (migration 0585): nome, tipo e configuração (filtros,
 * ordenação, agrupamento, colunas). São da ORGANIZAÇÃO — todos veem as mesmas.
 *
 * Leitura a partir de `viewer`; criar e editar a partir de `agent`, o mesmo corte de editar
 * as tarefas. A organização vem SEMPRE da sessão, nunca do corpo.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import {
  MAXIMO_DE_VISUALIZACOES,
  criacaoDeVisaoSchema,
  visaoDaLinha,
} from "@/lib/motor/visualizacoes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLUNAS = "id, organization_id, screen_key, name, type, config, position";

const consultaSchema = z.object({ screen: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/) });

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("viewer", { requestId, resource: "crm_saved_views" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = consultaSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return fail("validation_failed", t("Parâmetros inválidos."), 422, { requestId });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_saved_views")
    .select(COLUNAS)
    .eq("organization_id", authz.org.orgId)
    .eq("screen_key", parsed.data.screen)
    .order("position", { ascending: true })
    .limit(MAXIMO_DE_VISUALIZACOES + 20);

  if (error) {
    return fail("internal_error", t("Erro ao listar as visualizações."), 500, { requestId });
  }
  return ok({ views: (data ?? []).map(visaoDaLinha) }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

  const authz = await requireRole("agent", { requestId, resource: "crm_saved_views" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = criacaoDeVisaoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("crm_saved_views")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", authz.org.orgId)
    .eq("screen_key", parsed.data.screen_key);
  if ((count ?? 0) >= MAXIMO_DE_VISUALIZACOES) {
    return fail("validation_failed", t("Limite de visualizações atingido."), 422, { requestId });
  }

  const { data, error } = await supabase
    .from("crm_saved_views")
    .insert({
      ...parsed.data,
      organization_id: authz.org.orgId,
      created_by: authz.user.id,
    })
    .select(COLUNAS)
    .single();

  if (error) {
    return fail("internal_error", t("Erro ao salvar a visualização."), 500, { requestId });
  }

  const visao = visaoDaLinha(data);

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_saved_view.created",
    resourceType: "crm_saved_views",
    resourceId: visao.id,
    requestId,
    metadata: { name: visao.name, type: visao.type, screen: visao.screen_key },
  });

  return ok({ view: visao }, { requestId, status: 201 });
}
