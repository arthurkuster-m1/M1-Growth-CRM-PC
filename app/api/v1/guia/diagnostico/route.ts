/**
 * GET /api/v1/guia/diagnostico — o diagnóstico de marketing da empresa ativa: o perfil gravado, o
 * estado de cada passo do mapa, a prontidão e os próximos passos (docs/PLANO-GUIA-M1.md).
 *
 * Piso `manager`. Org da org ativa (cookie validado), NUNCA do query/body. Só LEITURA, pelo client
 * de SESSÃO (a RLS vale). O perfil e as marcações à mão vêm de `guia_perfil`/`guia_passos`; sem a
 * migration 0702 responde 503 com a frase que diz o que fazer (a tela não vira "erro ao carregar").
 */
import { fail, ok } from "@/lib/api/wrappers";
import { coletarSinais } from "@/lib/guia/coletar-sinais";
import { diagnosticar } from "@/lib/guia/diagnostico";
import { GuiaSemMigration, lerGuardado } from "@/lib/guia/guardado";
import { perfilParaDiagnostico } from "@/lib/guia/perfil";
import { SEM_MIGRATION, autorizarGuia } from "@/lib/guia/servidor";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const a = await autorizarGuia(false);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a;

  try {
    const [guardado, sinais] = await Promise.all([
      lerGuardado(supabase, orgId),
      coletarSinais(supabase, orgId),
    ]);
    const diagnostico = diagnosticar({
      perfil: guardado.perfil ? perfilParaDiagnostico(guardado.perfil) : null,
      sinais,
      manuais: guardado.manuais,
      tarefas: guardado.tarefas,
      agora: new Date(),
    });
    return ok({ perfil: guardado.perfil, diagnostico }, { requestId });
  } catch (e) {
    if (e instanceof GuiaSemMigration)
      return fail("guia_sem_migration", SEM_MIGRATION, 503, { requestId });
    logger.error("[guia.diagnostico] falhou", {
      orgId,
      erro: e instanceof Error ? e.message : String(e),
    });
    return fail("internal_error", "Não foi possível montar o diagnóstico agora.", 500, {
      requestId,
    });
  }
}
