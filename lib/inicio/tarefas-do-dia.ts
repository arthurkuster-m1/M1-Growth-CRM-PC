import { estaEncerrada, type Tarefa } from "@/lib/tarefas/tipos";

import { chaveDoDia } from "./datas";

const PESO_DA_PRIORIDADE: Record<Tarefa["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * O que a tela Início chama de "tarefas do dia": o que ainda pede ação e vence hoje
 * ou já venceu. Tarefa sem prazo fica de fora — ela não é "do dia" de ninguém — e
 * mora na tela de Tarefas.
 *
 * Atrasadas primeiro (a mais antiga no topo); depois as de hoje, por prioridade e
 * horário. A comparação é por CHAVE de dia no fuso da organização, não por instante:
 * "vence hoje às 23h" não pode virar "atrasada" por causa do UTC.
 */
export function tarefasDoDia(
  tarefas: readonly Tarefa[],
  hoje: string,
  fuso: string,
): { atrasadas: Tarefa[]; hoje: Tarefa[] } {
  const atrasadas: Tarefa[] = [];
  const deHoje: Tarefa[] = [];
  for (const tarefa of tarefas) {
    if (estaEncerrada(tarefa) || !tarefa.due_date) continue;
    const dia = chaveDoDia(new Date(tarefa.due_date), fuso);
    if (dia < hoje) atrasadas.push(tarefa);
    else if (dia === hoje) deHoje.push(tarefa);
  }
  const porPrazo = (a: Tarefa, b: Tarefa) =>
    new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
  atrasadas.sort(porPrazo);
  deHoje.sort(
    (a, b) => PESO_DA_PRIORIDADE[a.priority] - PESO_DA_PRIORIDADE[b.priority] || porPrazo(a, b),
  );
  return { atrasadas, hoje: deHoje };
}
