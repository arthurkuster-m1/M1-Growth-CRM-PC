/**
 * POST /api/v1/guia/ideias/gerar — roda o motor de regras AGORA para a empresa ativa (o cron faz o
 * mesmo todo dia): cria as ideias novas e mede de novo as aceitas que chegaram na data. Só gera
 * sugestão. Manager+, org da org ativa, rastro em `audit()`.
 */
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { gerarEMedirIdeias } from "@/lib/guia/gerar-ideias";
import { GuiaSemMigration, faltaMigrationDoGuia } from "@/lib/guia/guardado";
import { SEM_IDEIAS, SEM_MIGRATION, autorizarGuia } from "@/lib/guia/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarGuia(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a;

  try {
    const r = await gerarEMedirIdeias(supabase, orgId);
    if (r.semPerfil) {
      return fail("validation_failed", "Preencha o perfil do negócio antes de gerar ideias.", 422, {
        requestId,
      });
    }
    await audit({
      organizationId: orgId,
      actorUserId: userId,
      action: "guia.ideias_geradas",
      resourceType: "guia_ideias",
      resourceId: orgId,
      requestId,
      metadata: { criadas: r.criadas, medidas: r.medidas },
    });
    return ok(r, { requestId });
  } catch (e) {
    if (e instanceof GuiaSemMigration)
      return fail("guia_sem_migration", SEM_MIGRATION, 503, { requestId });
    if (faltaMigrationDoGuia(e as { code?: string; message?: string })) {
      return fail("guia_ideias_sem_migration", SEM_IDEIAS, 503, { requestId });
    }
    logger.error("[guia.ideias.gerar] falhou", {
      orgId,
      erro: e instanceof Error ? e.message : String(e),
    });
    return fail("internal_error", "Não foi possível gerar as ideias agora.", 500, { requestId });
  }
}
