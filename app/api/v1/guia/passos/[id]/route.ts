/**
 * PUT /api/v1/guia/passos/[id] — marca um passo do mapa à mão: "feito", "dispensado" (com motivo)
 * ou `null` (reabrir: volta a valer o que o detector diz). A marcação vence o detector, porque
 * detector errado nunca pode travar ninguém. Manager+, org da org ativa, rastro em `audit()`.
 * O id vem da URL e só vale se for um passo do catálogo.
 */
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { passoPorId } from "@/lib/guia/catalogo";
import { faltaMigrationDoGuia, registrarHistorico } from "@/lib/guia/guardado";
import { SEM_MIGRATION, autorizarGuia, lerCorpo } from "@/lib/guia/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };

const corpoSchema = z.object({
  estado: z.enum(["feito", "dispensado"]).nullable(),
  motivo: z.string().trim().max(500).nullish(),
});

export async function PUT(req: Request, { params }: Contexto): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarGuia(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a;
  const { id } = await params;
  if (!passoPorId(id)) return fail("validation_failed", "Passo desconhecido.", 422, { requestId });
  const corpo = await lerCorpo(req, corpoSchema, requestId);
  if (!corpo.ok) return corpo.response;
  const { estado, motivo } = corpo.dados;

  const agora = new Date().toISOString();
  let erro: { code?: string; message?: string } | null;
  if (estado) {
    ({ error: erro } = await supabase.from("guia_passos").upsert(
      {
        organization_id: orgId,
        passo_id: id,
        estado,
        motivo: estado === "dispensado" && motivo ? motivo : null,
        marcado_em: agora,
        marcado_por: userId,
        updated_at: agora,
      },
      { onConflict: "organization_id,passo_id" },
    ));
  } else {
    ({ error: erro } = await supabase
      .from("guia_passos")
      .update({
        estado: null,
        motivo: null,
        marcado_em: null,
        marcado_por: null,
        updated_at: agora,
      })
      .eq("organization_id", orgId)
      .eq("passo_id", id));
    // Sem marcação, sem tarefa ligada e fora do plano, a linha não tem mais nada a guardar.
    if (!erro) {
      const apagar = (soForaDoPlano: boolean) => {
        const q = supabase
          .from("guia_passos")
          .delete()
          .eq("organization_id", orgId)
          .eq("passo_id", id)
          .is("estado", null)
          .is("task_id", null);
        return soForaDoPlano ? q.eq("no_plano", false) : q;
      };
      let r = await apagar(true);
      // Banco sem a 0703: não há plano, então nenhuma linha está nele.
      if (r.error && faltaMigrationDoGuia(r.error)) r = await apagar(false);
      erro = r.error;
    }
  }
  if (erro) {
    if (faltaMigrationDoGuia(erro))
      return fail("guia_sem_migration", SEM_MIGRATION, 503, { requestId });
    return fail("internal_error", "Não foi possível salvar a marcação.", 500, { requestId });
  }

  await registrarHistorico(supabase, {
    orgId,
    userId,
    passoId: id,
    acao: estado ? "passo_marcado" : "passo_reaberto",
    detalhe: estado
      ? { estado, ...(estado === "dispensado" && motivo ? { motivo: motivo.slice(0, 200) } : {}) }
      : {},
  });
  await audit({
    organizationId: orgId,
    actorUserId: userId,
    action: estado ? "guia.passo_marcado" : "guia.passo_reaberto",
    resourceType: "guia_passos",
    resourceId: id,
    requestId,
    metadata: { passo: id, estado },
  });
  return ok({ passo: id, estado }, { requestId });
}
