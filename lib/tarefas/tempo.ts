/**
 * O TEMPO DAS TAREFAS (timer estilo ClickUp, migration 0689): ler o que o banco guarda e as contas
 * da tela. Cada lançamento fechado tem a duração; o que está rodando conta até agora.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CronometroRodando {
  user_id: string;
  /** ISO-8601: quando a pessoa apertou Iniciar. */
  started_at: string;
}

export interface TempoDaTarefa {
  /** Soma dos lançamentos já fechados, em segundos. */
  tempo_gasto_seg: number;
  /** Quem está cronometrando esta tarefa agora (uma entrada por pessoa). */
  cronometros: CronometroRodando[];
}

export const SEM_TEMPO: TempoDaTarefa = { tempo_gasto_seg: 0, cronometros: [] };

interface LinhaDeTempo {
  task_id: string;
  total_seconds: number | string;
  running: CronometroRodando[] | null;
}

/**
 * Os tempos de TODAS as tarefas da empresa, por id. Falha em silêncio (devolve vazio): a lista de
 * tarefas não pode quebrar porque o timer não está disponível (ex.: migration ainda não aplicada).
 */
export async function temposDasTarefas(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Map<string, TempoDaTarefa>> {
  const mapa = new Map<string, TempoDaTarefa>();
  try {
    const { data, error } = await supabase.rpc("fn_tempos_das_tarefas", {
      p_organization_id: organizationId,
    });
    if (error) return mapa;
    for (const l of (data ?? []) as LinhaDeTempo[]) {
      mapa.set(l.task_id, {
        tempo_gasto_seg: Number(l.total_seconds) || 0,
        cronometros: l.running ?? [],
      });
    }
  } catch {
    /* sem timer: a lista segue sem tempo */
  }
  return mapa;
}

export async function temposDaTarefa(
  supabase: SupabaseClient,
  organizationId: string,
  taskId: string,
): Promise<TempoDaTarefa> {
  return (await temposDasTarefas(supabase, organizationId)).get(taskId) ?? SEM_TEMPO;
}

/** Quantos segundos a tarefa já tem agora: o fechado + o que cada cronômetro rodando já contou. */
export function segundosDaTarefa(
  tarefa: { tempo_gasto_seg?: number; cronometros?: CronometroRodando[] },
  agora: number,
): number {
  const rodando = (tarefa.cronometros ?? []).reduce(
    (soma, c) => soma + Math.max(0, Math.floor((agora - Date.parse(c.started_at)) / 1000)),
    0,
  );
  return (tarefa.tempo_gasto_seg ?? 0) + rodando;
}

/** "1:05:09" (h:mm:ss) e, abaixo de 1 hora, "5:09" (m:ss). */
export function formatarDuracao(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Texto curto para listas e agrupamentos: "2h 05min", "12min", "40s" ou "—" quando é zero. */
export function duracaoCurta(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

export const euCronometro = (
  tarefa: { cronometros?: CronometroRodando[] },
  userId: string,
): CronometroRodando | undefined => (tarefa.cronometros ?? []).find((c) => c.user_id === userId);
