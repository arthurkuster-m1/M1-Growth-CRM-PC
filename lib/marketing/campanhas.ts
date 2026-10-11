import { z } from "zod";

/**
 * AS CAMPANHAS DE DEMANDA (migration 0595): uma campanha do Software é uma AÇÃO DE VENDAS, que
 * pode ter várias campanhas da plataforma (Meta, Google…) atreladas. Aqui moram os vocabulários,
 * a validação e as contas — tudo puro, sem tela.
 *
 * ⚠️ A FORMA de `CANAIS_DA_CAMPANHA`, `STATUS_DA_CAMPANHA`, `PERIODOS_DO_ORCAMENTO` e
 * `TIPOS_DE_NOTA` é requisito de instrumento: o extrator de
 * `tests/invariants/vocabulario-banco-x-typescript.test.ts` lê `const X = [...] as const`.
 */
export const CANAIS_DA_CAMPANHA = [
  "trafego_pago",
  "prospeccao",
  "social_media",
  "indicacao",
  "parcerias",
  "aproveitamento_de_base",
] as const;
export type CanalDaCampanha = (typeof CANAIS_DA_CAMPANHA)[number];

export const STATUS_DA_CAMPANHA = ["planejada", "ativa", "pausada", "encerrada"] as const;
export type StatusDaCampanha = (typeof STATUS_DA_CAMPANHA)[number];

export const PERIODOS_DO_ORCAMENTO = ["total", "diario", "semanal", "mensal"] as const;
export type PeriodoDoOrcamento = (typeof PERIODOS_DO_ORCAMENTO)[number];

export const TIPOS_DE_NOTA = ["analise", "feedback", "planejamento", "otimizacao"] as const;
export type TipoDeNota = (typeof TIPOS_DE_NOTA)[number];

/** Uma campanha da plataforma atrelada: o id (da plataforma, quando já aparece no relatório) e o nome. */
export interface CampanhaDaPlataforma {
  id: string | null;
  name: string;
}

export interface CampanhaDeDemanda {
  id: string;
  name: string;
  channel: CanalDaCampanha;
  status: StatusDaCampanha;
  description: string;
  idea: string;
  objective: string;
  start_date: string | null;
  end_date: string | null;
  continuous: boolean;
  pipeline_id: string | null;
  owner_id: string | null;
  budget: number | null;
  budget_period: PeriodoDoOrcamento;
  tax_pct: number;
  goal_leads: number | null;
  goal_cpl: number | null;
  goal_sales: number | null;
  goal_revenue: number | null;
  platform: string;
  sheet_url: string;
  platform_campaigns: CampanhaDaPlataforma[];
  /** Conta de anúncio do Meta (act_<id>); vazio = a padrão da conexão. */
  meta_account_id: string;
  meta_synced_at: string | null;
  meta_sync_error: string;
  position: number;
  created_at: string;
  /** Da última nota de cada tipo (só a agência as recebe). */
  ultima_analise?: { data: string; texto: string } | null;
  ultimo_planejamento?: { data: string; texto: string } | null;
  /** O resumo do período (investido e leads do CRM); só a listagem o traz. */
  estado?: EstadoDaCampanha | null;
}

/** "Estado atual": o que a campanha fez no período (o mês, se contínua; o total, se tem datas). */
export interface EstadoDaCampanha {
  de: string;
  ate: string;
  investido: number;
  leads: number;
}

export const COLUNAS_DA_CAMPANHA =
  "id, name, channel, status, description, idea, objective, start_date, end_date, continuous, pipeline_id, owner_id, budget, budget_period, tax_pct, goal_leads, goal_cpl, goal_sales, goal_revenue, platform, sheet_url, platform_campaigns, meta_account_id, meta_synced_at, meta_sync_error, position, created_at";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dinheiro = z.number().finite().min(0).max(1e10);
const contagem = z.number().int().min(0).max(1e9);

const campanhaDaPlataformaSchema = z.object({
  id: z.string().trim().max(60).nullable(),
  name: z.string().trim().min(1).max(200),
});

const camposSchema = z.object({
  name: z.string().trim().min(1).max(160),
  channel: z.enum(CANAIS_DA_CAMPANHA),
  status: z.enum(STATUS_DA_CAMPANHA),
  description: z.string().trim().max(4000),
  idea: z.string().trim().max(4000),
  objective: z.string().trim().max(2000),
  start_date: dia.nullable(),
  end_date: dia.nullable(),
  continuous: z.boolean(),
  pipeline_id: z.string().uuid().nullable(),
  owner_id: z.string().uuid().nullable(),
  budget: dinheiro.nullable(),
  budget_period: z.enum(PERIODOS_DO_ORCAMENTO),
  tax_pct: z.number().finite().min(0).max(100),
  goal_leads: contagem.nullable(),
  goal_cpl: dinheiro.nullable(),
  goal_sales: contagem.nullable(),
  goal_revenue: dinheiro.nullable(),
  platform: z.string().trim().max(40),
  sheet_url: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u === "" || /^https?:\/\/[^\s]+$/i.test(u), { message: "Use um link http(s)." }),
  platform_campaigns: z.array(campanhaDaPlataformaSchema).max(50),
  meta_account_id: z
    .string()
    .trim()
    .regex(/^(act_\d{1,30})?$/),
});

const periodoValido = (v: { start_date?: string | null; end_date?: string | null }) =>
  !v.start_date || !v.end_date || v.end_date >= v.start_date;

/** Criar: só o nome é obrigatório; o resto tem padrão. */
export const novaCampanhaSchema = camposSchema
  .partial()
  .required({ name: true })
  .refine(periodoValido, { message: "O fim vem depois do início." });

/**
 * Editar: ausente = não mexe. Sem `.default()` de propósito (no Zod 4 o `.partial()` reaplicaria
 * o padrão do campo ausente).
 */
export const edicaoDeCampanhaSchema = camposSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." })
  .refine(periodoValido, { message: "O fim vem depois do início." });

export const novaNotaSchema = z.object({
  kind: z.enum(TIPOS_DE_NOTA),
  body: z.string().trim().min(1).max(4000),
  note_date: dia.optional(),
});

export interface NotaDaCampanha {
  id: string;
  kind: TipoDeNota;
  note_date: string;
  body: string;
  author_id: string | null;
  created_at: string;
}
export const COLUNAS_DA_NOTA = "id, kind, note_date, body, author_id, created_at";

/** A linha do banco (numeric chega como texto em alguns caminhos) como `CampanhaDeDemanda`. */
export function campanhaDaLinha(l: Record<string, unknown>): CampanhaDeDemanda {
  const numero = (v: unknown): number | null =>
    v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
  const lista = Array.isArray(l.platform_campaigns) ? l.platform_campaigns : [];
  return {
    ...(l as unknown as CampanhaDeDemanda),
    budget: numero(l.budget),
    tax_pct: numero(l.tax_pct) ?? 0,
    goal_cpl: numero(l.goal_cpl),
    goal_revenue: numero(l.goal_revenue),
    goal_leads: numero(l.goal_leads),
    goal_sales: numero(l.goal_sales),
    position: Number(l.position),
    platform_campaigns: lista
      .map((c) => campanhaDaPlataformaSchema.safeParse(c))
      .flatMap((r) => (r.success ? [r.data] : [])),
  };
}

/** O investimento líquido: o bruto sem o imposto (bruto ÷ (1 + imposto)). */
export function investimentoLiquido(bruto: number, impostoPct: number): number {
  return bruto / (1 + impostoPct / 100);
}

/** A campanha está andando hoje? (ativa; ou, sem status ativo, dentro do período) */
export function emAndamento(c: Pick<CampanhaDeDemanda, "status">): boolean {
  return c.status === "ativa";
}
