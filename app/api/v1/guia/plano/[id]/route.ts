/**
 * PUT /api/v1/guia/plano/[id] — põe um passo no plano do cliente, tira dele, ou muda quem faz
 * (`lado`: agência ou cliente), o responsável, o prazo e a ordem. Cada campo é opcional; só o que
 * veio muda. Se o passo já tem tarefa, responsável, prazo e lado vão junto para a tarefa (que fica
 * na semana certa do Cronograma). Manager+, org da org ativa, rastro em `audit()` e no histórico.
 *
 * O responsável precisa ser membro ATIVO da mesma empresa: a conferência é no banco, não no corpo.
 */
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { passoPorId } from "@/lib/guia/catalogo";
import { faltaMigrationDoGuia, registrarHistorico } from "@/lib/guia/guardado";
import { ladoPadraoDoPasso, prazoParaTarefa } from "@/lib/guia/plano";
import { autorizarGuia, lerCorpo } from "@/lib/guia/servidor";
import { LADOS_DO_PLANO } from "@/lib/guia/tipos";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };

const corpoSchema = z
  .object({
    noPlano: z.boolean(),
    lado: z.enum(LADOS_DO_PLANO).nullable(),
    responsavelId: z.string().uuid().nullable(),
    prazo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    ordem: z.number().finite(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para mudar." });

const SEM_PLANO =
  "O banco ainda não recebeu a atualização do plano (migration 0703). Peça para aplicá-la na VPS.";

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
  const c = corpo.dados;

  if (c.responsavelId) {
    const membro = await supabase
      .from("user_organizations")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", c.responsavelId)
      .not("accepted_at", "is", null)
      .is("revoked_at", null)
      .maybeSingle();
    if (!membro.data) {
      return fail("validation_failed", "O responsável precisa ser alguém ativo da equipe.", 422, {
        requestId,
      });
    }
  }

  const antes = await supabase
    .from("guia_passos")
    .select("no_plano,lado,responsavel_id,prazo,task_id")
    .eq("organization_id", orgId)
    .eq("passo_id", id)
    .maybeSingle();
  if (antes.error) {
    if (faltaMigrationDoGuia(antes.error))
      return fail("guia_sem_migration", SEM_PLANO, 503, { requestId });
    return fail("internal_error", "Não foi possível salvar o plano.", 500, { requestId });
  }
  const anterior = antes.data as {
    no_plano: boolean;
    lado: string | null;
    responsavel_id: string | null;
    prazo: string | null;
    task_id: string | null;
  } | null;

  const linha: Record<string, unknown> = {
    organization_id: orgId,
    passo_id: id,
    updated_at: new Date().toISOString(),
  };
  if (c.noPlano !== undefined) {
    linha.no_plano = c.noPlano;
    // Ao entrar no plano ganha o lado costumeiro do passo, se ninguém escolheu.
    if (c.noPlano && c.lado === undefined && !anterior?.lado) linha.lado = ladoPadraoDoPasso(id);
  }
  if (c.lado !== undefined) linha.lado = c.lado;
  if (c.responsavelId !== undefined) linha.responsavel_id = c.responsavelId;
  if (c.prazo !== undefined) linha.prazo = c.prazo;
  if (c.ordem !== undefined) linha.ordem = c.ordem;

  const { error } = await supabase
    .from("guia_passos")
    .upsert(linha, { onConflict: "organization_id,passo_id" });
  if (error) {
    if (faltaMigrationDoGuia(error))
      return fail("guia_sem_migration", SEM_PLANO, 503, { requestId });
    return fail("internal_error", "Não foi possível salvar o plano.", 500, { requestId });
  }

  // A tarefa ligada acompanha o plano: responsável, prazo e lado (e sai da semana se saiu do plano).
  let tarefaAtualizada = false;
  if (anterior?.task_id) {
    const doTarefa: Record<string, unknown> = {};
    if (c.responsavelId !== undefined) doTarefa.assigned_to = c.responsavelId;
    if (c.prazo !== undefined) doTarefa.due_date = c.prazo ? prazoParaTarefa(c.prazo) : null;
    if (c.noPlano === false) doTarefa.cronograma_lado = null;
    else if (c.lado !== undefined) doTarefa.cronograma_lado = c.lado;
    if (Object.keys(doTarefa).length > 0) {
      const r = await supabase
        .from("crm_tasks")
        .update(doTarefa)
        .eq("organization_id", orgId)
        .eq("id", anterior.task_id);
      tarefaAtualizada = !r.error;
    }
  }

  const mudou: Record<string, unknown> = {};
  if (c.lado !== undefined) mudou.lado = { de: anterior?.lado ?? null, para: c.lado };
  if (c.responsavelId !== undefined)
    mudou.responsavel = { de: anterior?.responsavel_id ?? null, para: c.responsavelId };
  if (c.prazo !== undefined) mudou.prazo = { de: anterior?.prazo ?? null, para: c.prazo };
  if (c.ordem !== undefined) mudou.ordem = true;
  const entrou = c.noPlano === true && !anterior?.no_plano;
  const saiu = c.noPlano === false && anterior?.no_plano === true;
  await registrarHistorico(supabase, {
    orgId,
    userId,
    passoId: id,
    acao: entrou ? "plano_adicionado" : saiu ? "plano_removido" : "plano_alterado",
    detalhe: mudou,
  });
  await audit({
    organizationId: orgId,
    actorUserId: userId,
    action: "guia.plano_item_alterado",
    resourceType: "guia_passos",
    resourceId: id,
    requestId,
    metadata: { passo: id, campos: Object.keys(c), entrou, saiu },
  });
  return ok({ passo: id, tarefaAtualizada }, { requestId });
}
