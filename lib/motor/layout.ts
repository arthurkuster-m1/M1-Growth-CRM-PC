import { z } from "zod";

import { consultaSchema } from "./consulta";

/**
 * O LAYOUT de uma tabela estilo Notion: a ordem, a largura e a visibilidade das colunas.
 *
 * Duas camadas, de propósito:
 *  - o que a TELA declara (`DefinicaoDeColuna`): quais colunas existem, a largura de
 *    fábrica e se começam visíveis;
 *  - o que a PESSOA escolheu (`PreferenciasDaTabela`): só os desvios do padrão.
 *
 * Guardar só os desvios é o que deixa o sistema evoluir: coluna nova que a tela passa a
 * declarar aparece no fim, na largura de fábrica, para todo mundo — sem migrar as
 * preferências de ninguém. Coluna que sumiu da tela simplesmente deixa de ser lida.
 */
export const LARGURA_MINIMA = 80;
export const LARGURA_MAXIMA = 900;

const MAXIMO_DE_COLUNAS = 100;

/** A forma guardada em `user_view_preferences.config` — a mesma que a rota valida. */
export const preferenciasDaTabelaSchema = z
  .object({
    /** Ids na ordem escolhida (as colunas fixas ficam de fora: o título é sempre o primeiro). */
    ordem: z.array(z.string().min(1).max(80)).max(MAXIMO_DE_COLUNAS).optional(),
    larguras: z
      .record(z.string().min(1).max(80), z.number().min(LARGURA_MINIMA).max(LARGURA_MAXIMA))
      .refine((r) => Object.keys(r).length <= MAXIMO_DE_COLUNAS)
      .optional(),
    visiveis: z
      .record(z.string().min(1).max(80), z.boolean())
      .refine((r) => Object.keys(r).length <= MAXIMO_DE_COLUNAS)
      .optional(),
    /** Como a pessoa vê os dados: tabela, quadro, calendário ou linha do tempo. */
    visualizacao: z.enum(["tabela", "kanban", "calendario", "linha"]).optional(),
    /** Filtros, ordenação e agrupamento (ver `consulta.ts`). */
    ...consultaSchema.shape,
  })
  .strict();

export type PreferenciasDaTabela = z.infer<typeof preferenciasDaTabelaSchema>;

export interface DefinicaoDeColuna {
  id: string;
  /** Largura de fábrica, em px. */
  largura: number;
  /** Fixa = fica sempre visível e sempre primeira (o título). */
  fixa?: boolean;
  /** `false` = começa escondida. Padrão: visível. */
  padrao?: boolean;
}

export type ColunaResolvida<T extends DefinicaoDeColuna> = T & { visivel: boolean };

export function limitarLargura(largura: number): number {
  if (!Number.isFinite(largura)) return LARGURA_MINIMA;
  return Math.min(LARGURA_MAXIMA, Math.max(LARGURA_MINIMA, Math.round(largura)));
}

/**
 * Todas as colunas, na ordem e na largura efetivas, cada uma com o seu `visivel`.
 * (Quem desenha filtra por `visivel`; quem monta o menu de propriedades usa a lista
 * inteira.)
 */
export function resolverColunas<T extends DefinicaoDeColuna>(
  definicoes: readonly T[],
  preferencias: PreferenciasDaTabela | undefined,
): ColunaResolvida<T>[] {
  const prefs = preferencias ?? {};
  const porId = new Map(definicoes.map((d) => [d.id, d]));

  const fixas = definicoes.filter((d) => d.fixa);
  const escolhidas = (prefs.ordem ?? [])
    .map((id) => porId.get(id))
    .filter((d): d is T => d !== undefined && !d.fixa);
  const jaOrdenadas = new Set(escolhidas.map((d) => d.id));
  // Coluna nova (a tela passou a declará-la depois da escolha da pessoa): vai para o fim.
  const novas = definicoes.filter((d) => !d.fixa && !jaOrdenadas.has(d.id));

  return [...fixas, ...escolhidas, ...novas].map((d) => ({
    ...d,
    largura: limitarLargura(prefs.larguras?.[d.id] ?? d.largura),
    visivel: d.fixa ? true : (prefs.visiveis?.[d.id] ?? d.padrao !== false),
  }));
}

/**
 * A ordem (só das colunas NÃO fixas) depois de arrastar `idMovido` para a posição de
 * `idAlvo`. Opera sobre a lista COMPLETA, escondidas inclusive: esconder uma coluna não
 * pode embaralhar as outras quando ela voltar.
 */
export function moverColuna(
  ordemAtual: readonly string[],
  idMovido: string,
  idAlvo: string,
): string[] {
  const de = ordemAtual.indexOf(idMovido);
  const para = ordemAtual.indexOf(idAlvo);
  if (de < 0 || para < 0 || de === para) return [...ordemAtual];
  const copia = [...ordemAtual];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item!);
  return copia;
}
