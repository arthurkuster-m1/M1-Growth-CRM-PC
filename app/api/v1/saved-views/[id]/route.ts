import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PATCH  /api/v1/saved-views/[id] — renomeia, muda o tipo, a configuração ou a ordem.
 * DELETE /api/v1/saved-views/[id] — apaga a visualização (as tarefas não são tocadas).
 *
 * Editar a configuração é o que acontece a cada filtro, ordenação ou coluna que a pessoa
 * muda dentro da aba: a tela manda de uma vez, depois de uma pausa. Por isso a edição
 * grava SEM auditoria — auditar cada arrasto de coluna encheria o log; criar, renomear,
 * trocar o tipo e apagar são os eventos que importam e esses são registrados.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { edicaoDeVisaoSchema, visaoDaLinha } from "@/lib/motor/visualizacoes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLUNAS = "id, organization_id, screen_key, name, type, config, position";

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("agent", { requestId, resource: "crm_saved_views" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = edicaoDeVisaoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_saved_views")
    .update(parsed.data)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select(COLUNAS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return fail("not_found", t("Visualização não encontrada."), 404, { requestId });
    }
    return fail("internal_error", t("Erro ao salvar a visualização."), 500, { requestId });
  }

  const visao = visaoDaLinha(data);

  if (parsed.data.name !== undefined || parsed.data.type !== undefined) {
    await audit({
      organizationId: authz.org.orgId,
      actorUserId: authz.user.id,
      action: "crm_saved_view.updated",
      resourceType: "crm_saved_views",
      resourceId: visao.id,
      requestId,
      metadata: { campos: Object.keys(parsed.data).filter((k) => k !== "config") },
    });
  }

  return ok({ view: visao }, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("agent", { requestId, resource: "crm_saved_views" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_saved_views")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id");

  if (error) {
    return fail("internal_error", t("Erro ao apagar a visualização."), 500, { requestId });
  }
  if (!data || data.length === 0) {
    return fail("not_found", t("Visualização não encontrada."), 404, { requestId });
  }

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_saved_view.deleted",
    resourceType: "crm_saved_views",
    resourceId: id,
    requestId,
  });

  return ok({ deleted: true }, { requestId });
}
