/**
 * GET /api/v1/marketing/cronograma/historico-semanas — o histórico POR SEMANA (manager+): para cada
 * semana, as tarefas feitas e não feitas, a nota da autoavaliação e os eventos (entrou, adiada…).
 * Olha as últimas 26 semanas.
 */
import { fail, ok } from "@/lib/api/wrappers";
import { somarDias } from "@/lib/inicio/datas";
import { COLUNAS_DA_AUTOAVALIACAO } from "@/lib/marketing/autoavaliacao";
import {
  COLUNAS_DA_TAREFA_NO_CRONOGRAMA,
  domingoDeHoje,
  tarefaDoCronograma,
} from "@/lib/marketing/cronograma";
import { autorizarCronograma } from "@/lib/marketing/cronograma-servidor";
import { resumoDasSemanas, type EventoDaSemana } from "@/lib/marketing/historico-das-semanas";

export const dynamic = "force-dynamic";

const SEMANAS = 26;

export async function GET(): Promise<Response> {
  const a = await autorizarCronograma("manager", false);
  if (!a.ok) return a.response;
  const hoje = domingoDeHoje();
  const desde = somarDias(hoje, -7 * SEMANAS);
  const desdeIso = new Date(`${desde}T00:00:00Z`).toISOString();

  const [tarefas, eventos, notas] = await Promise.all([
    a.supabase
      .from("crm_tasks")
      .select(COLUNAS_DA_TAREFA_NO_CRONOGRAMA)
      .eq("organization_id", a.orgId)
      .not("cronograma_lado", "is", null)
      .gte("due_date", desdeIso)
      .order("due_date", { ascending: false })
      .limit(2000),
    a.supabase
      .from("crm_task_historico")
      .select("id, task_id, tipo, de_prazo, para_prazo, motivo, created_at, crm_tasks(title)")
      .eq("organization_id", a.orgId)
      .gte("created_at", desdeIso)
      .order("created_at", { ascending: false })
      .limit(2000),
    a.supabase
      .from("marketing_cronograma_autoavaliacoes")
      .select(COLUNAS_DA_AUTOAVALIACAO)
      .eq("organization_id", a.orgId)
      .gte("semana_inicio", desde)
      .limit(SEMANAS + 4),
  ]);
  if (tarefas.error || eventos.error || notas.error)
    return fail("internal_error", a.t("Erro ao carregar o histórico."), 500, {
      requestId: a.requestId,
    });

  const evs: EventoDaSemana[] = (
    (eventos.data ?? []) as unknown as Array<
      Omit<EventoDaSemana, "titulo"> & { crm_tasks: { title: string } | null }
    >
  ).map(({ crm_tasks, ...e }) => ({ ...e, titulo: crm_tasks?.title ?? null }));
  const semanas = resumoDasSemanas(
    ((tarefas.data ?? []) as Array<Parameters<typeof tarefaDoCronograma>[0]>).map(
      tarefaDoCronograma,
    ),
    evs,
    notas.data ?? [],
    hoje,
  );
  return ok({ semanas }, { requestId: a.requestId });
}
