/**
 * POST /api/v1/guia/plano/montar — monta o PLANO PADRÃO do cliente: põe no plano os passos
 * essenciais que ainda faltam, na ordem do mapa (que já respeita as dependências). Só ACRESCENTA:
 * o que já está no plano (com responsável, prazo e ordem) não é tocado. Manager+, org da org
 * ativa, rastro em `audit()` e no histórico.
 */
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { coletarSinais } from "@/lib/guia/coletar-sinais";
import { diagnosticar } from "@/lib/guia/diagnostico";
import {
  GuiaSemMigration,
  faltaMigrationDoGuia,
  lerGuardado,
  registrarHistorico,
} from "@/lib/guia/guardado";
import { perfilParaDiagnostico } from "@/lib/guia/perfil";
import { ladoPadraoDoPasso, planoPadrao } from "@/lib/guia/plano";
import { SEM_MIGRATION, autorizarGuia } from "@/lib/guia/servidor";
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
    const [guardado, sinais] = await Promise.all([
      lerGuardado(supabase, orgId),
      coletarSinais(supabase, orgId),
    ]);
    if (!guardado.planoDisponivel) {
      return fail(
        "guia_sem_migration",
        "O banco ainda não recebeu a atualização do plano (migration 0703). Peça para aplicá-la na VPS.",
        503,
        { requestId },
      );
    }
    if (!guardado.perfil) {
      return fail(
        "validation_failed",
        "Preencha o perfil do negócio antes de montar o plano.",
        422,
        { requestId },
      );
    }
    const diagnostico = diagnosticar({
      perfil: perfilParaDiagnostico(guardado.perfil),
      sinais,
      manuais: guardado.manuais,
      tarefas: guardado.tarefas,
      agora: new Date(),
    });
    const jaNoPlano = new Set(guardado.plano.map((i) => i.passoId));
    const novos = planoPadrao(diagnostico).filter((id) => !jaNoPlano.has(id));
    if (novos.length === 0) return ok({ adicionados: 0 }, { requestId });

    // Ordem: depois do último item do plano (ou do epoch, como o padrão da coluna), de 1 em 1.
    const base =
      guardado.plano.length > 0
        ? Math.max(...guardado.plano.map((i) => i.ordem))
        : Date.now() / 1000;
    const agora = new Date().toISOString();
    const { error } = await supabase.from("guia_passos").upsert(
      novos.map((id, i) => ({
        organization_id: orgId,
        passo_id: id,
        no_plano: true,
        lado: ladoPadraoDoPasso(id),
        ordem: base + i + 1,
        updated_at: agora,
      })),
      { onConflict: "organization_id,passo_id" },
    );
    if (error) {
      if (faltaMigrationDoGuia(error))
        return fail("guia_sem_migration", SEM_MIGRATION, 503, { requestId });
      return fail("internal_error", "Não foi possível montar o plano.", 500, { requestId });
    }
    await registrarHistorico(supabase, {
      orgId,
      userId,
      acao: "plano_montado",
      detalhe: { passos: novos },
    });
    await audit({
      organizationId: orgId,
      actorUserId: userId,
      action: "guia.plano_montado",
      resourceType: "guia_passos",
      resourceId: orgId,
      requestId,
      metadata: { adicionados: novos.length },
    });
    return ok({ adicionados: novos.length, passos: novos }, { requestId, status: 201 });
  } catch (e) {
    if (e instanceof GuiaSemMigration)
      return fail("guia_sem_migration", SEM_MIGRATION, 503, { requestId });
    logger.error("[guia.plano.montar] falhou", {
      orgId,
      erro: e instanceof Error ? e.message : String(e),
    });
    return fail("internal_error", "Não foi possível montar o plano.", 500, { requestId });
  }
}
