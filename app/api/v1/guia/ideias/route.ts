/**
 * GET /api/v1/guia/ideias — as ideias do Guia (novas, aceitas, para medir e as já resolvidas), os
 * aprendizados e as regras com seus limiares (só leitura: a tela mostra o que dispara cada ideia).
 *
 * Piso `manager`. Org da org ativa (cookie validado), NUNCA do query/body. Client de SESSÃO (a RLS
 * vale). Sem a migration 0704 responde 503 com a frase que diz o que fazer.
 */
import { fail, ok } from "@/lib/api/wrappers";
import { faltaMigrationDoGuia } from "@/lib/guia/guardado";
import { LIMIARES, REGRAS_DE_IDEIA } from "@/lib/guia/ideias";
import {
  COLUNAS_DA_IDEIA,
  COLUNAS_DO_APRENDIZADO,
  aprendizadoDaLinha,
  ideiaDaLinha,
} from "@/lib/guia/ideias-guardadas";
import { SEM_IDEIAS, autorizarGuia } from "@/lib/guia/servidor";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const a = await autorizarGuia(false);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a;

  const [ideias, aprendizados] = await Promise.all([
    supabase
      .from("guia_ideias")
      .select(COLUNAS_DA_IDEIA)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("guia_aprendizados")
      .select(COLUNAS_DO_APRENDIZADO)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);
  const erro = ideias.error ?? aprendizados.error;
  if (erro) {
    if (faltaMigrationDoGuia(erro))
      return fail("guia_ideias_sem_migration", SEM_IDEIAS, 503, { requestId });
    return fail("internal_error", "Não foi possível carregar as ideias.", 500, { requestId });
  }
  return ok(
    {
      ideias: ((ideias.data ?? []) as unknown as Record<string, unknown>[]).map(ideiaDaLinha),
      aprendizados: ((aprendizados.data ?? []) as unknown as Record<string, unknown>[]).map(
        aprendizadoDaLinha,
      ),
      regras: REGRAS_DE_IDEIA,
      limiares: LIMIARES,
    },
    { requestId },
  );
}
