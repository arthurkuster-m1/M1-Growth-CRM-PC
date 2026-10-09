import { z } from "zod";

import { blocosSchema, type Bloco } from "./blocos";
import { moduloPorChave } from "./modulos";

/** A chave de módulo vem da URL: só vale se é um dos módulos da estratégia. */
export const chaveDeModuloSchema = z.string().refine((k) => moduloPorChave(k) !== undefined, {
  message: "Módulo desconhecido.",
});

/** O que a agência manda ao gravar o rascunho. */
export const edicaoDeRascunhoSchema = z.object({
  title: z.string().trim().max(200).optional(),
  blocks: blocosSchema,
});

/** Uma página de marketing como a tela a recebe. */
export interface PaginaDeMarketing {
  module_key: string;
  title: string;
  /** O que o cliente vê. `null` = ainda não publicado ("em breve"). */
  published_blocks: Bloco[] | null;
  published_at: string | null;
  /** O rascunho — só vem para quem é da agência (a RLS esconde dos demais). */
  draft: { blocks: Bloco[]; updated_at: string } | null;
  pode_editar: boolean;
}

export const COLUNAS_DA_PAGINA = "id, module_key, title, published_blocks, published_at";
