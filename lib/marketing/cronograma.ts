import { z } from "zod";

import { chaveDoDia, diaDaSemanaDaChave, somarDias } from "@/lib/inicio/datas";

/**
 * O CRONOGRAMA DO CLIENTE (migration 0591): as barras do cronograma geral e as tarefas da
 * semana. Aqui moram os tipos, a validação e as contas de semana — tudo puro, sem tela.
 */

/** O fuso de leitura das datas. O produto é brasileiro: a semana vira à meia-noite de Brasília. */
export const FUSO_DO_CRONOGRAMA = "America/Sao_Paulo";

export const STATUS_DO_ITEM = ["planejado", "andamento", "concluido"] as const;
export type StatusDoItem = (typeof STATUS_DO_ITEM)[number];

export const LADOS_DA_TAREFA = ["agencia", "cliente"] as const;
export type LadoDaTarefa = (typeof LADOS_DA_TAREFA)[number];

export const MAXIMO_DE_SEMANAS = 26;

export interface ItemDoCronograma {
  id: string;
  acao: string;
  semana_inicio: number;
  semana_fim: number;
  status: StatusDoItem;
  destaque: boolean;
  notas: string;
  /** A fase a que a ação pertence (ex.: "Estruturação"); vazio = sem fase. */
  fase: string;
  ordem: number;
}

export interface MetaDoCronograma {
  id: string;
  titulo: string;
  alvo: string;
  atual: string;
  descricao: string;
  ordem: number;
}

export const COLUNAS_DA_META = "id, titulo, alvo, atual, descricao, ordem";

export interface ConfigDoCronograma {
  total_semanas: number;
  /** A segunda-feira da semana 1 (`YYYY-MM-DD`). Nula = sem datas, só "S1, S2…". */
  data_inicio: string | null;
  subtitulo_geral: string;
  subtitulo_semana: string;
}

export const CONFIG_PADRAO: ConfigDoCronograma = {
  total_semanas: 8,
  data_inicio: null,
  subtitulo_geral: "",
  subtitulo_semana: "",
};

export const COLUNAS_DO_ITEM =
  "id, acao, semana_inicio, semana_fim, status, destaque, notas, fase, ordem";
export const COLUNAS_DA_CONFIG = "total_semanas, data_inicio, subtitulo_geral, subtitulo_semana";

const chaveDeData = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const itemSchema = z
  .object({
    acao: z.string().trim().min(1).max(200),
    semana_inicio: z.number().int().min(1).max(MAXIMO_DE_SEMANAS),
    semana_fim: z.number().int().min(1).max(MAXIMO_DE_SEMANAS),
    status: z.enum(STATUS_DO_ITEM).default("planejado"),
    destaque: z.boolean().default(false),
    notas: z.string().trim().max(500).default(""),
    fase: z.string().trim().max(80).default(""),
  })
  .refine((v) => v.semana_fim >= v.semana_inicio, { message: "O fim vem depois do início." });

export const edicaoDeItemSchema = z
  .object({
    acao: z.string().trim().min(1).max(200),
    semana_inicio: z.number().int().min(1).max(MAXIMO_DE_SEMANAS),
    semana_fim: z.number().int().min(1).max(MAXIMO_DE_SEMANAS),
    status: z.enum(STATUS_DO_ITEM),
    destaque: z.boolean(),
    notas: z.string().trim().max(500),
    fase: z.string().trim().max(80),
  })
  .partial();

export const metaSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
  alvo: z.string().trim().max(40).default(""),
  atual: z.string().trim().max(40).default(""),
  descricao: z.string().trim().max(200).default(""),
});
export const edicaoDeMetaSchema = metaSchema.partial();

export const configSchema = z.object({
  total_semanas: z.number().int().min(1).max(MAXIMO_DE_SEMANAS),
  data_inicio: chaveDeData.nullable(),
  subtitulo_geral: z.string().trim().max(200),
  subtitulo_semana: z.string().trim().max(200),
});

/** A segunda-feira da semana que contém `chave`. */
export function segundaDe(chave: string): string {
  return somarDias(chave, -diaDaSemanaDaChave(chave));
}

/** A segunda-feira de hoje (no fuso do cronograma). */
export function segundaDeHoje(agora: Date = new Date()): string {
  return segundaDe(chaveDoDia(agora, FUSO_DO_CRONOGRAMA));
}

/** Que semana do cronograma (1…n) é a que começa em `segunda`? `null` fora do intervalo. */
export function numeroDaSemana(
  config: Pick<ConfigDoCronograma, "data_inicio" | "total_semanas">,
  segunda: string,
): number | null {
  if (!config.data_inicio) return null;
  const dias = Math.round(
    (Date.parse(`${segunda}T12:00:00Z`) - Date.parse(`${config.data_inicio}T12:00:00Z`)) /
      86_400_000,
  );
  const n = Math.floor(dias / 7) + 1;
  return n >= 1 && n <= config.total_semanas ? n : null;
}

/** A segunda-feira da semana `n` (1…). */
export function segundaDaSemana(data_inicio: string, n: number): string {
  return somarDias(data_inicio, (n - 1) * 7);
}

/** "27/10" a partir de `YYYY-MM-DD`. */
export function diaMes(chave: string): string {
  const [, m, d] = chave.split("-");
  return `${d}/${m}`;
}

/** "27/10 – 02/11" da semana que começa em `segunda`. */
export function periodoDaSemana(segunda: string): string {
  return `${diaMes(segunda)} – ${diaMes(somarDias(segunda, 6))}`;
}

/** Os limites da semana como instantes ISO (segunda 00:00 até a segunda seguinte), no fuso. */
export interface TarefaDoCronograma {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "done" | "cancelled";
  due_date: string | null;
  prazo_original: string | null;
  adiamentos: number;
  lado: LadoDaTarefa;
}

export const COLUNAS_DA_TAREFA_NO_CRONOGRAMA =
  "id, title, status, due_date, prazo_original, adiamentos, cronograma_lado";

export function tarefaDoCronograma(linha: {
  id: string;
  title: string;
  status: TarefaDoCronograma["status"];
  due_date: string | null;
  prazo_original: string | null;
  adiamentos: number | null;
  cronograma_lado: string | null;
}): TarefaDoCronograma {
  return {
    id: linha.id,
    title: linha.title,
    status: linha.status,
    due_date: linha.due_date,
    prazo_original: linha.prazo_original,
    adiamentos: linha.adiamentos ?? 0,
    lado: linha.cronograma_lado === "cliente" ? "cliente" : "agencia",
  };
}

/** Situação para a tela do cliente: o que ele precisa entender de relance. */
export type SituacaoDaTarefa = "feita" | "andamento" | "a_fazer" | "atrasada" | "cancelada";

export function situacaoDaTarefa(
  t: Pick<TarefaDoCronograma, "status" | "due_date">,
  agora = new Date(),
): SituacaoDaTarefa {
  if (t.status === "done") return "feita";
  if (t.status === "cancelled") return "cancelada";
  if (t.due_date) {
    const dia = chaveDoDia(new Date(t.due_date), FUSO_DO_CRONOGRAMA);
    if (dia < chaveDoDia(agora, FUSO_DO_CRONOGRAMA)) return "atrasada";
  }
  return t.status === "in_progress" ? "andamento" : "a_fazer";
}

/**
 * As tarefas da semana que começa em `segunda`: as que vencem nela, as atrasadas ainda abertas
 * (que continuam pesando) e as concluídas dentro dela. O cancelado some.
 */
export function tarefasDaSemana(
  todas: readonly TarefaDoCronograma[],
  segunda: string,
  agora: Date = new Date(),
): TarefaDoCronograma[] {
  const domingo = somarDias(segunda, 6);
  return todas.filter((t) => {
    if (t.status === "cancelled" || !t.due_date) return false;
    const dia = chaveDoDia(new Date(t.due_date), FUSO_DO_CRONOGRAMA);
    if (dia >= segunda && dia <= domingo) return true;
    // Atrasada e aberta: pesa na semana corrente e nas seguintes, até ser resolvida. Nas semanas
    // já passadas não entra: o que ficou para trás está no histórico, e não na vista da semana.
    return t.status !== "done" && dia < segunda && segunda >= segundaDeHoje(agora);
  });
}

export const motivoSchema = z.string().trim().min(1).max(500);

export const novaTarefaSchema = z.object({
  /** Incluir uma tarefa que já existe na base… */
  id: z.string().uuid().optional(),
  /** …ou criar uma nova. */
  title: z.string().trim().min(1).max(255).optional(),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
  lado: z.enum(LADOS_DA_TAREFA).default("agencia"),
});

export const edicaoDeTarefaSchema = z.object({
  lado: z.enum(LADOS_DA_TAREFA).nullable().optional(),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
  status: z.enum(["pending", "in_progress", "done", "cancelled"]).optional(),
  motivo: z.string().trim().max(500).optional(),
});

export const fechamentoSchema = z.object({
  inicio: chaveDeData,
  decisoes: z
    .array(
      z.object({
        task_id: z.string().uuid(),
        acao: z.enum(["concluir", "adiar", "manter", "cancelar"]),
        novo_prazo: z.string().datetime({ offset: true }).nullable().optional(),
        motivo: z.string().trim().max(500).optional(),
      }),
    )
    .max(200),
});

/** Um progresso 0–100 a partir de "alvo" e "atual" em texto livre; `null` se não dá para ler. */
export function progressoDaMeta(alvo: string, atual: string): number | null {
  const a = numeroDoTexto(alvo);
  const b = numeroDoTexto(atual);
  if (a === null || b === null || a <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((b / a) * 100)));
}

function numeroDoTexto(texto: string): number | null {
  const m = texto.match(/-?\d[\d.,]*/);
  if (!m) return null;
  let s = m[0];
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** As fases, na ordem em que aparecem, com a faixa de semanas e a situação (feita/ativa/futura). */
export interface FaseDoCronograma {
  nome: string;
  inicio: number;
  fim: number;
  situacao: "feita" | "ativa" | "futura";
}

export function fasesDoCronograma(
  itens: readonly ItemDoCronograma[],
  semanaAtual: number | null,
): FaseDoCronograma[] {
  const mapa = new Map<string, ItemDoCronograma[]>();
  for (const i of itens) {
    const nome = i.fase.trim();
    if (!nome) continue;
    mapa.set(nome, [...(mapa.get(nome) ?? []), i]);
  }
  return [...mapa.entries()].map(([nome, lista]) => {
    const inicio = Math.min(...lista.map((i) => i.semana_inicio));
    const fim = Math.max(...lista.map((i) => i.semana_fim));
    const todasFeitas = lista.every((i) => i.status === "concluido");
    const algumaAndando = lista.some((i) => i.status === "andamento");
    const naJanela = semanaAtual !== null && semanaAtual >= inicio && semanaAtual <= fim;
    const situacao: FaseDoCronograma["situacao"] = todasFeitas
      ? "feita"
      : algumaAndando || naJanela
        ? "ativa"
        : "futura";
    return { nome, inicio, fim, situacao };
  });
}
