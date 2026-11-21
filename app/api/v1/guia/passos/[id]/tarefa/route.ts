/**
 * POST /api/v1/guia/passos/[id]/tarefa — cria, em Tarefas, a tarefa de fazer este passo e liga as
 * duas (o diagnóstico mostra "Tarefa criada"). Idempotente: se o passo já tem uma tarefa que ainda
 * existe, devolve a mesma em vez de duplicar. Manager+, org da org ativa, rastro em `audit()`.
 */
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { passoPorId } from "@/lib/guia/catalogo";
import { faltaMigrationDoGuia, registrarHistorico } from "@/lib/guia/guardado";
import { prazoParaTarefa } from "@/lib/guia/plano";
import { SEM_MIGRATION, autorizarGuia } from "@/lib/guia/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Contexto): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarGuia(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a;
  const { id } = await params;
  const passo = passoPorId(id);
  if (!passo) return fail("validation_failed", "Passo desconhecido.", 422, { requestId });

  // Com a 0703 o passo pode estar no plano (responsável, prazo e lado); sem ela só existe o vínculo.
  type Linha = {
    task_id: string | null;
    no_plano?: boolean;
    lado?: "agencia" | "cliente" | null;
    responsavel_id?: string | null;
    prazo?: string | null;
  };
  const ler = (colunas: string) =>
    supabase
      .from("guia_passos")
      .select(colunas)
      .eq("organization_id", orgId)
      .eq("passo_id", id)
      .maybeSingle();
  let atual = await ler("task_id,no_plano,lado,responsavel_id,prazo");
  if (atual.error && faltaMigrationDoGuia(atual.error)) atual = await ler("task_id");
  if (atual.error) {
    if (faltaMigrationDoGuia(atual.error))
      return fail("guia_sem_migration", SEM_MIGRATION, 503, { requestId });
    return fail("internal_error", "Não foi possível criar a tarefa.", 500, { requestId });
  }
  const linha = (atual.data ?? null) as unknown as Linha | null;
  if (linha?.task_id) {
    return ok({ taskId: linha.task_id, criada: false }, { requestId });
  }
  // Passo no plano: a tarefa nasce com quem faz e até quando, e entra na semana do Cronograma.
  const noPlano = linha?.no_plano === true;

  const { data: tarefa, error } = await supabase
    .from("crm_tasks")
    .insert({
      organization_id: orgId,
      created_by: userId,
      title: passo.titulo.slice(0, 255),
      description: `${passo.porque}\n\nOnde fazer: ${passo.onde.rotulo} (${passo.onde.href})\nPasso ${passo.id} do Guia de marketing.`,
      priority: "medium",
      status: "pending",
      ...(noPlano
        ? {
            assigned_to: linha?.responsavel_id ?? null,
            due_date: linha?.prazo ? prazoParaTarefa(linha.prazo) : null,
            cronograma_lado: linha?.lado ?? null,
          }
        : {}),
    })
    .select("id")
    .single();
  if (error || !tarefa)
    return fail("internal_error", "Não foi possível criar a tarefa.", 500, { requestId });

  const { error: erroDoVinculo } = await supabase.from("guia_passos").upsert(
    {
      organization_id: orgId,
      passo_id: id,
      task_id: tarefa.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,passo_id" },
  );
  if (erroDoVinculo) {
    // A tarefa já existe em Tarefas; só o vínculo falhou. Diz a verdade em vez de fingir sucesso.
    return fail(
      "internal_error",
      "A tarefa foi criada, mas não foi possível ligá-la ao passo.",
      500,
      { requestId },
    );
  }

  await registrarHistorico(supabase, {
    orgId,
    userId,
    passoId: id,
    acao: "tarefa_criada",
    detalhe: { noPlano },
  });
  await audit({
    organizationId: orgId,
    actorUserId: userId,
    action: "guia.tarefa_criada",
    resourceType: "crm_tasks",
    resourceId: tarefa.id as string,
    requestId,
    metadata: { passo: id },
  });
  return ok({ taskId: tarefa.id as string, criada: true }, { requestId, status: 201 });
}
