import { chaveDoDia, somarDias } from "@/lib/inicio/datas";
import { domingoDe, FUSO_DO_CRONOGRAMA, type TarefaDoCronograma } from "@/lib/marketing/cronograma";

export interface EventoDaSemana {
  id: string;
  task_id: string;
  tipo: string;
  de_prazo: string | null;
  para_prazo: string | null;
  motivo: string | null;
  created_at: string;
  titulo: string | null;
}

export interface ResumoDaSemana {
  semana_inicio: string;
  feitas: TarefaDoCronograma[];
  nao_feitas: TarefaDoCronograma[];
  /** Nota da autoavaliação (0–100); `null` = a semana não foi avaliada. */
  nota: number | null;
  eventos: EventoDaSemana[];
}

/**
 * O histórico POR SEMANA (e não por tarefa): para cada semana (domingo a sábado), as tarefas do
 * prazo dela que foram feitas e as que não foram, a nota da autoavaliação e os eventos
 * (entrou, adiada, saiu, cancelada…). Cancelada não conta como "não feita": foi tirada do plano.
 * Mais recente primeiro; só entram semanas com algo para mostrar.
 */
export function resumoDasSemanas(
  tarefas: readonly TarefaDoCronograma[],
  eventos: readonly EventoDaSemana[],
  notas: ReadonlyArray<{ semana_inicio: string; nota: number }>,
  ateSemana: string,
): ResumoDaSemana[] {
  const mapa = new Map<string, ResumoDaSemana>();
  const da = (semana: string) => {
    let r = mapa.get(semana);
    if (!r) {
      r = { semana_inicio: semana, feitas: [], nao_feitas: [], nota: null, eventos: [] };
      mapa.set(semana, r);
    }
    return r;
  };
  const limite = domingoDe(ateSemana);
  const dentro = (semana: string) => semana <= limite;
  for (const t of tarefas) {
    if (t.status === "cancelled" || !t.due_date) continue;
    const semana = domingoDe(chaveDoDia(new Date(t.due_date), FUSO_DO_CRONOGRAMA));
    if (!dentro(semana)) continue;
    (t.status === "done" ? da(semana).feitas : da(semana).nao_feitas).push(t);
  }
  for (const e of eventos) {
    const semana = domingoDe(chaveDoDia(new Date(e.created_at), FUSO_DO_CRONOGRAMA));
    if (dentro(semana)) da(semana).eventos.push(e);
  }
  for (const n of notas) if (dentro(n.semana_inicio)) da(n.semana_inicio).nota = n.nota;
  return [...mapa.values()].sort((a, b) => b.semana_inicio.localeCompare(a.semana_inicio));
}

export const fimDaSemana = (inicio: string): string => somarDias(inicio, 6);
