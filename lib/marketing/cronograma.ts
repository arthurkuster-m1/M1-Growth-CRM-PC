import { z } from "zod";

import { chaveDoDia, somarDias } from "@/lib/inicio/datas";

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

/** O cronograma não termina: o número da semana vai até 520 (10 anos). */
export const MAXIMO_DE_SEMANAS = 520;
/** Quantas semanas cabem na tela de uma vez. */
export const MAXIMO_DA_JANELA = 26;

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
  /** Concluída e tirada do gráfico (volta ao desarquivar). */
  arquivado: boolean;
  ordem: number;
}

/** Como o valor da meta é lido e mostrado: R$, número (com unidade: leads, vendas…) ou %. */
export const TIPOS_DE_META = ["moeda", "numero", "percentual"] as const;
export type TipoDeMeta = (typeof TIPOS_DE_META)[number];

export interface MetaDoCronograma {
  id: string;
  titulo: string;
  tipo: TipoDeMeta;
  /** Só para `numero`: "leads", "vendas", "clientes"… */
  unidade: string;
  valor_alvo: number | null;
  valor_atual: number | null;
  descricao: string;
  ordem: number;
}

export type DadosDaMeta = Pick<
  MetaDoCronograma,
  "titulo" | "tipo" | "unidade" | "valor_alvo" | "valor_atual" | "descricao"
>;

export const COLUNAS_DA_META =
  "id, titulo, tipo, unidade, valor_alvo, valor_atual, descricao, ordem";

const comoNumero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** A linha do banco (numeric chega como texto em alguns caminhos) como `MetaDoCronograma`. */
export function metaDaLinha(linha: Record<string, unknown>): MetaDoCronograma {
  return {
    id: String(linha.id),
    titulo: String(linha.titulo ?? ""),
    tipo: (TIPOS_DE_META as readonly string[]).includes(String(linha.tipo))
      ? (linha.tipo as TipoDeMeta)
      : "numero",
    unidade: String(linha.unidade ?? ""),
    valor_alvo: comoNumero(linha.valor_alvo),
    valor_atual: comoNumero(linha.valor_atual),
    descricao: String(linha.descricao ?? ""),
    ordem: Number(linha.ordem),
  };
}

export interface ConfigDoCronograma {
  total_semanas: number;
  /** O domingo da semana 1 (`YYYY-MM-DD`). Nula = sem datas, só "S1, S2…". */
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
  "id, acao, semana_inicio, semana_fim, status, destaque, notas, fase, arquivado, ordem";

/** A linha do banco (ordem é numeric) como `ItemDoCronograma`. */
export function itemDaLinha(linha: Record<string, unknown>): ItemDoCronograma {
  return { ...(linha as unknown as ItemDoCronograma), ordem: Number(linha.ordem) };
}
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
    arquivado: z.boolean().default(false),
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
    arquivado: z.boolean(),
  })
  .partial();

const valorDeMeta = z.number().finite().min(-1e12).max(1e12).nullable();

export const metaSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
  tipo: z.enum(TIPOS_DE_META).default("numero"),
  unidade: z.string().trim().max(20).default(""),
  valor_alvo: valorDeMeta.default(null),
  valor_atual: valorDeMeta.default(null),
  descricao: z.string().trim().max(200).default(""),
});

// Sem `.default()`: no Zod 4 o `.partial()` reaplica o padrão de campo ausente, e editar só o
// alvo zeraria o tipo e a unidade. Na edição, ausente = não mexe.
export const edicaoDeMetaSchema = z
  .object({
    titulo: z.string().trim().min(1).max(120),
    tipo: z.enum(TIPOS_DE_META),
    unidade: z.string().trim().max(20),
    valor_alvo: valorDeMeta,
    valor_atual: valorDeMeta,
    descricao: z.string().trim().max(200),
  })
  .partial();

export const configSchema = z.object({
  total_semanas: z.number().int().min(1).max(MAXIMO_DA_JANELA),
  data_inicio: chaveDeData.nullable(),
  subtitulo_geral: z.string().trim().max(200),
  subtitulo_semana: z.string().trim().max(200),
});

/** O domingo da semana que contém `chave` (a semana do cronograma começa no domingo). */
export function domingoDe(chave: string): string {
  const diaDaSemana = new Date(`${chave}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return somarDias(chave, -diaDaSemana);
}

/** O domingo de hoje (no fuso do cronograma). */
export function domingoDeHoje(agora: Date = new Date()): string {
  return domingoDe(chaveDoDia(agora, FUSO_DO_CRONOGRAMA));
}

/** Que semana do cronograma (1…) é a que começa em `domingo`? `null` antes do início. */
export function numeroDaSemana(
  config: Pick<ConfigDoCronograma, "data_inicio">,
  domingo: string,
): number | null {
  if (!config.data_inicio) return null;
  const dias = Math.round(
    (Date.parse(`${domingo}T12:00:00Z`) -
      Date.parse(`${domingoDe(config.data_inicio)}T12:00:00Z`)) /
      86_400_000,
  );
  const n = Math.floor(dias / 7) + 1;
  return n >= 1 && n <= MAXIMO_DE_SEMANAS ? n : null;
}

/** O domingo da semana `n` (1…). */
export function domingoDaSemana(data_inicio: string, n: number): string {
  return somarDias(domingoDe(data_inicio), (n - 1) * 7);
}

/** A primeira semana da janela da tela: a de hoje com uma de folga para trás. */
export function inicioDaJanela(semanaAtual: number | null, total: number): number {
  const maximo = Math.max(1, MAXIMO_DE_SEMANAS - total + 1);
  return Math.min(maximo, Math.max(1, (semanaAtual ?? 1) - 1));
}

/** "27/10" a partir de `YYYY-MM-DD`. */
export function diaMes(chave: string): string {
  const [, m, d] = chave.split("-");
  return `${d}/${m}`;
}

/** "27/10 – 02/11" da semana que começa em `domingo`. */
export function periodoDaSemana(domingo: string): string {
  return `${diaMes(domingo)} – ${diaMes(somarDias(domingo, 6))}`;
}

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
 * As tarefas da semana que começa em `domingo`: as que vencem nela, as atrasadas ainda abertas
 * (que continuam pesando) e as concluídas dentro dela. O cancelado some.
 */
export function tarefasDaSemana(
  todas: readonly TarefaDoCronograma[],
  domingo: string,
  agora: Date = new Date(),
): TarefaDoCronograma[] {
  const sabado = somarDias(domingo, 6);
  return todas.filter((t) => {
    if (t.status === "cancelled" || !t.due_date) return false;
    const dia = chaveDoDia(new Date(t.due_date), FUSO_DO_CRONOGRAMA);
    if (dia >= domingo && dia <= sabado) return true;
    // Atrasada e aberta: pesa na semana corrente e nas seguintes, até ser resolvida. Nas semanas
    // já passadas não entra: o que ficou para trás está no histórico, e não na vista da semana.
    return t.status !== "done" && dia < domingo && domingo >= domingoDeHoje(agora);
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

/** Progresso 0–100 da meta; `null` se falta o alvo ou ele não é positivo. */
export function progressoDaMeta(
  m: Pick<MetaDoCronograma, "valor_alvo" | "valor_atual">,
): number | null {
  if (m.valor_alvo === null || m.valor_alvo <= 0) return null;
  const atual = m.valor_atual ?? 0;
  return Math.max(0, Math.min(100, Math.round((atual / m.valor_alvo) * 100)));
}

/** O valor já no formato do tipo: R$ 15.000,00 · 1.200 leads · 35%. */
export function formatarValorDaMeta(
  valor: number | null,
  tipo: TipoDeMeta,
  unidade: string,
  tag: string,
): string {
  if (valor === null) return "—";
  if (tipo === "moeda") {
    return new Intl.NumberFormat(tag, { style: "currency", currency: "BRL" }).format(valor);
  }
  if (tipo === "percentual") {
    return `${new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(valor)}%`;
  }
  const n = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(valor);
  return unidade.trim() ? `${n} ${unidade.trim()}` : n;
}

/** Lê o que a pessoa digitou ("15.000,50", "R$ 1.500", "35,5%") como número. */
export function numeroDoTexto(texto: string): number | null {
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
    if (i.arquivado) continue;
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
