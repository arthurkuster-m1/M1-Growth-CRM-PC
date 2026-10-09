import { estaEncerrada, type Tarefa } from "@/lib/tarefas/tipos";

import { chaveDoDia } from "./datas";

const PESO_DA_PRIORIDADE: Record<Tarefa["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * O que a tela Início chama de "tarefas do dia": o que ainda pede ação e vence hoje, já
 * venceu, ou COMEÇA hoje (a tarefa com início hoje e prazo adiante é do dia dela). Tarefa
 * sem prazo e sem início hoje fica de fora — ela não é "do dia" de ninguém — e mora na tela
 * de Tarefas. Uma tarefa no meio de um intervalo longo (começou antes e termina depois) também
 * não entra: senão toda tarefa de projeto lotaria o Início todos os dias.
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
    if (estaEncerrada(tarefa)) continue;
    const comecaHoje = tarefa.start_date
      ? chaveDoDia(new Date(tarefa.start_date), fuso) === hoje
      : false;
    if (!tarefa.due_date) {
      if (comecaHoje) deHoje.push(tarefa);
      continue;
    }
    const dia = chaveDoDia(new Date(tarefa.due_date), fuso);
    if (dia < hoje) atrasadas.push(tarefa);
    else if (dia === hoje || comecaHoje) deHoje.push(tarefa);
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
