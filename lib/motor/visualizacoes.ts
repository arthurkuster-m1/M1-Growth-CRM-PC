import { z } from "zod";

import { preferenciasDaTabelaSchema, type PreferenciasDaTabela } from "./layout";

/**
 * AS VISUALIZAÇÕES SALVAS — as "abas" de uma tela estilo Notion (migration 0585).
 *
 * Cada uma é nome + tipo (tabela, quadro, calendário, linha do tempo) + `config` (a mesma
 * forma de `PreferenciasDaTabela`: filtros, ordenação, agrupamento, colunas). São da
 * ORGANIZAÇÃO: todo mundo vê as mesmas abas; criar e editar é de quem edita as tarefas.
 *
 * ⚠️ A FORMA de `TIPOS_DE_VISUALIZACAO` é requisito de instrumento, não estilo: o extrator
 * de `tests/invariants/vocabulario-banco-x-typescript.test.ts` lê `const X = [...] as const`
 * e compara com o CHECK da migration 0585.
 */
export const TIPOS_DE_VISUALIZACAO = ["tabela", "kanban", "calendario", "timeline"] as const;
export type TipoDeVisualizacao = (typeof TIPOS_DE_VISUALIZACAO)[number];

export const MAXIMO_DE_VISUALIZACOES = 30;

/** Uma linha de `crm_saved_views`, como a API a devolve. */
export interface VisaoSalva {
  id: string;
  organization_id: string;
  screen_key: string;
  name: string;
  type: TipoDeVisualizacao;
  config: PreferenciasDaTabela;
  position: number;
}

const nomeSchema = z.string().trim().min(1).max(60);
const telaSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);

export const criacaoDeVisaoSchema = z.object({
  screen_key: telaSchema,
  name: nomeSchema,
  type: z.enum(TIPOS_DE_VISUALIZACAO),
  config: preferenciasDaTabelaSchema.default({}),
  position: z.number().finite().optional(),
});

export const edicaoDeVisaoSchema = z
  .object({
    name: nomeSchema.optional(),
    type: z.enum(TIPOS_DE_VISUALIZACAO).optional(),
    config: preferenciasDaTabelaSchema.optional(),
    position: z.number().finite().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

/** Config lida do banco que já não passa na validação (a forma mudou) vira vazia: nunca derruba a tela. */
export function configSegura(bruto: unknown): PreferenciasDaTabela {
  const lida = preferenciasDaTabelaSchema.safeParse(bruto ?? {});
  return lida.success ? lida.data : {};
}

/** Uma linha de `crm_saved_views` já com a config validada. */
export function visaoDaLinha(linha: unknown): VisaoSalva {
  const l = linha as VisaoSalva;
  return { ...l, config: configSegura(l.config) };
}
