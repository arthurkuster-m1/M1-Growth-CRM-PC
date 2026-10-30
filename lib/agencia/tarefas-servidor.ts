import "server-only";

import type { ClienteDaAgencia } from "@/lib/agencia/acesso";
import type { TarefaDaAgencia } from "@/lib/agencia/tarefas";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * As tarefas "da agência" dos clientes escolhidos: abertas e as concluídas nos últimos 14 dias.
 * Lê com o cliente ADMIN, e por isso só recebe organizações que `clientesDaAgencia` já liberou
 * (filtra `organization_id` na consulta).
 */
export async function tarefasDaAgencia(
  clientes: readonly ClienteDaAgencia[],
  /** No Início, entram também as tarefas atribuídas a esta pessoa (não só as marcadas "da agência"). */
  opcoes: { minhas?: string } = {},
): Promise<TarefaDaAgencia[]> {
  if (clientes.length === 0) return [];
  const nome = new Map(clientes.map((c) => [c.id, c.name]));
  const cores = new Map(clientes.map((c) => [c.id, c.cor]));
  const desde = new Date(Date.now() - 14 * 86_400_000).toISOString();
  let consulta = createAdminClient()
    .from("crm_tasks")
    .select("id, title, status, due_date, adiamentos, organization_id, updated_at")
    .in("organization_id", [...nome.keys()]);
  consulta = opcoes.minhas
    ? consulta.or(`cronograma_lado.eq.agencia,assigned_to.eq.${opcoes.minhas}`)
    : consulta.eq("cronograma_lado", "agencia");
  const { data } = await consulta
    .or(`status.in.(pending,in_progress),and(status.eq.done,updated_at.gte.${desde})`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(2000);
  return (
    (data ?? []) as Array<{
      id: string;
      title: string;
      status: TarefaDaAgencia["status"];
      due_date: string | null;
      adiamentos: number | null;
      organization_id: string;
    }>
  ).map((r) => ({
    id: r.id,
    titulo: r.title,
    status: r.status,
    prazo: r.due_date,
    adiamentos: r.adiamentos ?? 0,
    clienteId: r.organization_id,
    cliente: nome.get(r.organization_id) ?? "",
    cor: cores.get(r.organization_id) ?? "#6b7684",
  }));
}
