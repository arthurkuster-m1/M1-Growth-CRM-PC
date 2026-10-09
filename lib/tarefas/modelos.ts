import { z } from "zod";

import { chaveDoDia, diaDaSemanaDaChave, inicioDoDia, somarDias } from "@/lib/inicio/datas";

import { PRIORIDADES_DA_TAREFA, type NovaTarefa, type PrioridadeDaTarefa } from "./tipos";

/**
 * MODELOS DE TAREFA e TAREFAS REPETIDAS (migration 0586).
 *
 * Um modelo é uma tarefa "de molde": título, descrição, prioridade, status, responsável e
 * prazo relativo ("3 dias depois de criada"). Serve para criar a tarefa com um clique — e,
 * se o modelo REPETE ("toda segunda às 7h"), o servidor cria a tarefa sozinho a cada
 * ocorrência. É o "Repetir" dos modelos do Notion: um conceito só, em vez de dois.
 *
 * Tudo aqui é puro (sem React, sem banco): o MESMO código monta a tarefa quando a pessoa
 * escolhe o modelo na tela e quando o agendador a cria na hora marcada, e calcula a próxima
 * ocorrência — por isso a regra não pode divergir entre os dois lados.
 *
 * ⚠️ A FORMA de `FREQUENCIAS_DE_REPETICAO` é requisito de instrumento: o extrator de
 * `tests/invariants/vocabulario-banco-x-typescript.test.ts` lê `const X = [...] as const`
 * e compara com o CHECK da migration 0586.
 */
export const FREQUENCIAS_DE_REPETICAO = ["daily", "weekly", "monthly"] as const;
export type FrequenciaDeRepeticao = (typeof FREQUENCIAS_DE_REPETICAO)[number];

export const MAXIMO_DE_MODELOS = 60;

/** As colunas de `crm_task_templates` que a API devolve. */
export const COLUNAS_DO_MODELO =
  "id, organization_id, name, title, description, priority, status_option_id, assigned_to, start_offset_days, due_offset_days, due_time, repeat_enabled, repeat_frequency, repeat_weekdays, repeat_day_of_month, repeat_time, next_run_at, last_run_at, position";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** O que a pessoa edita num modelo. (A próxima ocorrência quem calcula é o servidor.) */
export const modeloSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(255),
    description: z.string().max(5000).nullable().optional(),
    priority: z.enum(PRIORIDADES_DA_TAREFA).default("medium"),
    status_option_id: z.string().uuid().nullable().optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    /** Dias entre a criação e o início/prazo. `null` = a tarefa nasce sem início/prazo. */
    start_offset_days: z.number().int().min(-365).max(730).nullable().optional(),
    due_offset_days: z.number().int().min(-365).max(730).nullable().optional(),
    /** Horário do prazo. `null` = só a data (o dia todo). */
    due_time: hhmm.nullable().optional(),
    repeat_enabled: z.boolean().default(false),
    repeat_frequency: z.enum(FREQUENCIAS_DE_REPETICAO).nullable().optional(),
    /** 0 = segunda … 6 = domingo, como no resto do motor. */
    repeat_weekdays: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .transform((d) => [...new Set(d)].sort((a, b) => a - b))
      .default([]),
    repeat_day_of_month: z.number().int().min(1).max(31).nullable().optional(),
    /** A que horas (no relógio da organização) a tarefa nasce. */
    repeat_time: hhmm.default("07:00"),
  })
  .refine((m) => !m.repeat_enabled || m.repeat_frequency, {
    message: "Escolha com que frequência repete.",
    path: ["repeat_frequency"],
  })
  .refine(
    (m) => !(m.repeat_enabled && m.repeat_frequency === "weekly") || m.repeat_weekdays.length > 0,
    {
      message: "Escolha pelo menos um dia da semana.",
      path: ["repeat_weekdays"],
    },
  )
  .refine((m) => !(m.repeat_enabled && m.repeat_frequency === "monthly") || m.repeat_day_of_month, {
    message: "Escolha o dia do mês.",
    path: ["repeat_day_of_month"],
  });

export type EntradaDeModelo = z.input<typeof modeloSchema>;
export type DadosDoModelo = z.output<typeof modeloSchema>;

/** Uma linha de `crm_task_templates`, como a API a devolve. */
export interface ModeloDeTarefa extends DadosDoModelo {
  id: string;
  organization_id: string;
  next_run_at: string | null;
  last_run_at: string | null;
  position: number;
}

/** Campos do modelo que a repetição lê (o que `proximaExecucao` precisa). */
export type RegraDeRepeticao = Pick<
  DadosDoModelo,
  "repeat_enabled" | "repeat_frequency" | "repeat_weekdays" | "repeat_day_of_month" | "repeat_time"
>;

/** O instante em que o dia `chave` está em `HH:mm` no relógio do fuso. */
function momentoDoDia(chave: string, horario: string, fuso: string): Date {
  const [h, m] = horario.split(":").map(Number);
  return new Date(inicioDoDia(chave, fuso).getTime() + (h! * 60 + m!) * 60_000);
}

function diasDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * A PRÓXIMA ocorrência estritamente DEPOIS de `depois`, ou `null` se o modelo não repete.
 *
 * - diária: todo dia no horário;
 * - semanal: nos dias marcados (segunda = 0), no horário;
 * - mensal: no dia do mês; mês que não tem o dia (31 em abril) usa o último dia dele.
 */
export function proximaExecucao(regra: RegraDeRepeticao, depois: Date, fuso: string): Date | null {
  if (!regra.repeat_enabled || !regra.repeat_frequency) return null;
  const hoje = chaveDoDia(depois, fuso);
  const horario = regra.repeat_time;

  if (regra.repeat_frequency === "daily") {
    for (let i = 0; i <= 1; i++) {
      const momento = momentoDoDia(somarDias(hoje, i), horario, fuso);
      if (momento > depois) return momento;
    }
    return null;
  }

  if (regra.repeat_frequency === "weekly") {
    if (regra.repeat_weekdays.length === 0) return null;
    for (let i = 0; i <= 7; i++) {
      const dia = somarDias(hoje, i);
      if (!regra.repeat_weekdays.includes(diaDaSemanaDaChave(dia))) continue;
      const momento = momentoDoDia(dia, horario, fuso);
      if (momento > depois) return momento;
    }
    return null;
  }

  const desejado = regra.repeat_day_of_month;
  if (!desejado) return null;
  let [ano, mes] = hoje.split("-").map(Number) as [number, number];
  for (let i = 0; i < 14; i++) {
    const dia = Math.min(desejado, diasDoMes(ano, mes));
    const chave = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const momento = momentoDoDia(chave, horario, fuso);
    if (momento > depois) return momento;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return null;
}

/**
 * A tarefa que o modelo cria, tendo `base` (`YYYY-MM-DD`) como o "dia de hoje": início e
 * prazo saem de `base` mais os dias do modelo. Prazo sem horário vale o dia todo
 * (meia-noite do fuso, como no resto do motor).
 */
export function tarefaDoModelo(
  modelo: Pick<
    DadosDoModelo,
    | "title"
    | "description"
    | "priority"
    | "status_option_id"
    | "assigned_to"
    | "start_offset_days"
    | "due_offset_days"
    | "due_time"
  >,
  base: string,
  fuso: string,
): NovaTarefa {
  const prioridade: PrioridadeDaTarefa = modelo.priority;
  const tarefa: NovaTarefa = { title: modelo.title, priority: prioridade };
  if (modelo.description) tarefa.description = modelo.description;
  if (modelo.status_option_id) tarefa.status_option_id = modelo.status_option_id;
  if (modelo.assigned_to) tarefa.assigned_to = modelo.assigned_to;
  if (modelo.start_offset_days !== null && modelo.start_offset_days !== undefined) {
    tarefa.start_date = inicioDoDia(somarDias(base, modelo.start_offset_days), fuso).toISOString();
  }
  if (modelo.due_offset_days !== null && modelo.due_offset_days !== undefined) {
    tarefa.due_date = momentoDoDia(
      somarDias(base, modelo.due_offset_days),
      modelo.due_time ?? "00:00",
      fuso,
    ).toISOString();
  }
  return tarefa;
}

const NOMES_DOS_DIAS = [
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
  "domingo",
] as const;

/** Os dias da semana por extenso, na ordem (segunda → domingo), para a tela traduzir. */
export const DIAS_DA_SEMANA = NOMES_DOS_DIAS;
