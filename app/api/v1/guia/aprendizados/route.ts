/**
 * POST /api/v1/guia/aprendizados — registra à mão um aprendizado (o que fizemos, a hipótese, o
 * resultado e se funcionou). Os que vêm do veredito de uma ideia são criados pela rota da ideia.
 * Entram no Dossiê, para a IA não repetir o que já não deu certo. Manager+, org da org ativa,
 * rastro em `audit()`.
 */
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { faltaMigrationDoGuia } from "@/lib/guia/guardado";
import { COLUNAS_DO_APRENDIZADO, aprendizadoDaLinha } from "@/lib/guia/ideias-guardadas";
import { SEM_IDEIAS, autorizarGuia, lerCorpo } from "@/lib/guia/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  hipotese: z.string().trim().max(1000).nullish(),
  resultado: z.string().trim().max(2000).nullish(),
  veredito: z.enum(["funcionou", "nao_funcionou", "inconclusivo"]),
  campanhaId: z.string().uuid().nullish(),
});

export async function POST(req: Request): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarGuia(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a;
  const corpo = await lerCorpo(req, corpoSchema, requestId);
  if (!corpo.ok) return corpo.response;
  const c = corpo.dados;

  const { data, error } = await supabase
    .from("guia_aprendizados")
    .insert({
      organization_id: orgId,
      campanha_id: c.campanhaId ?? null,
      titulo: c.titulo,
      hipotese: c.hipotese || null,
      resultado: c.resultado || null,
      veredito: c.veredito,
      criado_por: userId,
    })
    .select(COLUNAS_DO_APRENDIZADO)
    .single();
  if (error || !data) {
    if (faltaMigrationDoGuia(error))
      return fail("guia_ideias_sem_migration", SEM_IDEIAS, 503, { requestId });
    if (error?.code === "23503")
      return fail("validation_failed", "Campanha inexistente.", 422, { requestId });
    return fail("internal_error", "Não foi possível salvar o aprendizado.", 500, { requestId });
  }
  await audit({
    organizationId: orgId,
    actorUserId: userId,
    action: "guia.aprendizado_criado",
    resourceType: "guia_aprendizados",
    resourceId: data.id as string,
    requestId,
    metadata: { veredito: c.veredito },
  });
  return ok(
    { aprendizado: aprendizadoDaLinha(data as unknown as Record<string, unknown>) },
    { requestId, status: 201 },
  );
}
