import { estaEncerrada, type Tarefa } from "@/lib/tarefas/tipos";

import { chaveDoDia } from "./datas";

const PESO_DA_PRIORIDADE: Record<Tarefa["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * O que a tela Início chama de "tarefas do dia": TODA tarefa em aberto (não concluída nem
 * cancelada) que já começou ou já tem prazo — início ou prazo hoje ou antes de hoje. Ou seja, o
 * que está em andamento no calendário e ainda pede ação: atrasada, vence hoje, começa hoje, ou
 * começou antes e ainda está no prazo. Tarefa sem início nem prazo, ou que só começa e vence
 * depois de hoje, fica de fora (mora na tela de Tarefas).
 *
 * Atrasadas primeiro (a mais antiga no topo); depois as demais, por prioridade e prazo. A
 * comparação é por CHAVE de dia no fuso da organização, não por instante: "vence hoje às 23h" não
 * pode virar "atrasada" por causa do UTC.
 */
export function tarefasDoDia(
  tarefas: readonly Tarefa[],
  hoje: string,
  fuso: string,
): { atrasadas: Tarefa[]; hoje: Tarefa[] } {
  const atrasadas: Tarefa[] = [];
  const deHoje: Tarefa[] = [];
  for (const tarefa of tarefas) {
    if (estaEncerrada(tarefa)) continue;
    const diaDoInicio = tarefa.start_date ? chaveDoDia(new Date(tarefa.start_date), fuso) : null;
    const diaDoPrazo = tarefa.due_date ? chaveDoDia(new Date(tarefa.due_date), fuso) : null;
    const jaComecou = diaDoInicio !== null && diaDoInicio <= hoje;
    const jaTemPrazo = diaDoPrazo !== null && diaDoPrazo <= hoje;
    if (!jaComecou && !jaTemPrazo) continue;
    if (diaDoPrazo !== null && diaDoPrazo < hoje) atrasadas.push(tarefa);
    else deHoje.push(tarefa);
  }
  // Sem prazo (só o início) vem depois das que têm prazo no dia.
  const instante = (t: Tarefa) =>
    new Date((t.due_date ?? t.start_date)!).getTime() + (t.due_date ? 0 : 86_400_000);
  const porPrazo = (a: Tarefa, b: Tarefa) => instante(a) - instante(b);
  atrasadas.sort(porPrazo);
  deHoje.sort(
    (a, b) => PESO_DA_PRIORIDADE[a.priority] - PESO_DA_PRIORIDADE[b.priority] || porPrazo(a, b),
  );
  return { atrasadas, hoje: deHoje };
}
