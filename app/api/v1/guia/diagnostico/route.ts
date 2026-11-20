/**
 * GET /api/v1/guia/diagnostico — o diagnóstico de marketing da empresa ativa: o estado de cada
 * passo do mapa, a prontidão e os próximos passos (docs/PLANO-GUIA-M1.md, G1).
 *
 * Piso `manager`. Org da org ativa (cookie validado), NUNCA do query/body. Só LEITURA, pelo client
 * de SESSÃO (a RLS vale). Perfil provisório pela URL (`?nicho=clinica&modelos=agendamento,whatsapp
 * &ja_tem_oferta=1`); sem `nicho`, só a fase de cadastros é avaliada. Não grava nada, então não há
 * `audit()`; a G2 grava perfil e marcações e passa a auditar.
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { coletarSinais } from "@/lib/guia/coletar-sinais";
import { diagnosticar } from "@/lib/guia/diagnostico";
import { lerPerfilDaUrl } from "@/lib/guia/perfil";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "guia",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;

  const perfil = lerPerfilDaUrl(new URL(request.url).searchParams);
  if (!perfil.ok) return fail("validation_failed", perfil.erro, 422, { requestId });

  try {
    const supabase = await createClient();
    const sinais = await coletarSinais(supabase, authz.org.orgId);
    const diagnostico = diagnosticar({ perfil: perfil.perfil, sinais, agora: new Date() });
    return ok(diagnostico, { requestId });
  } catch (e) {
    logger.error("[guia.diagnostico] falhou", {
      orgId: authz.org.orgId,
      erro: e instanceof Error ? e.message : String(e),
    });
    return fail("internal_error", "Não foi possível montar o diagnóstico agora.", 500, {
      requestId,
    });
  }
}
