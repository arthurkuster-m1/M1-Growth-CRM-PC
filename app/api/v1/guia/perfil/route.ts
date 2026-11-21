/**
 * PUT /api/v1/guia/perfil — grava o perfil do cliente (nicho, como vende, objetivo, links…).
 * Uma linha por empresa; a org vem da org ativa, nunca do corpo. Manager+, com a guarda do modo
 * somente leitura do suporte antes do efeito, e deixa rastro (`guia.perfil_salvo`).
 */
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { faltaMigrationDoGuia } from "@/lib/guia/guardado";
import { linhaDoPerfil, perfilDaLinha, perfilSchema } from "@/lib/guia/perfil";
import { SEM_MIGRATION, autorizarGuia, lerCorpo } from "@/lib/guia/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";

export async function PUT(req: Request): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarGuia(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a;
  const corpo = await lerCorpo(req, perfilSchema, requestId);
  if (!corpo.ok) return corpo.response;

  const { data, error } = await supabase
    .from("guia_perfil")
    .upsert(
      {
        organization_id: orgId,
        ...linhaDoPerfil(corpo.dados),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    )
    .select("*")
    .single();
  if (error || !data) {
    if (faltaMigrationDoGuia(error))
      return fail("guia_sem_migration", SEM_MIGRATION, 503, { requestId });
    return fail("internal_error", "Não foi possível salvar o perfil.", 500, { requestId });
  }

  await audit({
    organizationId: orgId,
    actorUserId: userId,
    action: "guia.perfil_salvo",
    resourceType: "guia_perfil",
    resourceId: orgId,
    requestId,
    metadata: { nicho: corpo.dados.nicho, modelos: corpo.dados.modelos },
  });
  return ok({ perfil: perfilDaLinha(data as Record<string, unknown>) }, { requestId });
}
