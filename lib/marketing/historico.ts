import { z } from "zod";

import { lerBlocos, type Bloco } from "@/lib/marketing/blocos";

/** Quantos retratos cada página guarda no máximo (o histórico é para acompanhar, não para arquivar tudo). */
export const MAXIMO_DE_RETRATOS = 60;
/** Quantos a tela carrega de uma vez (os mais recentes). */
export const RETRATOS_NA_TELA = 24;

export const retratoSchema = z.object({ note: z.string().trim().max(200).default("") });

/** Um retrato como a tela o recebe. */
export interface VersaoDaPagina {
  id: string;
  taken_at: string;
  note: string;
  blocos: Bloco[];
}

export const COLUNAS_DO_RETRATO = "id, taken_at, note, blocks";

/** Lê as linhas do banco para o formato da tela (bloco inválido é descartado, nunca quebra). */
export function versoesDasLinhas(
  linhas: ReadonlyArray<{ id: string; taken_at: string; note: string; blocks: unknown }>,
): VersaoDaPagina[] {
  return linhas.map((l) => ({
    id: l.id,
    taken_at: l.taken_at,
    note: l.note,
    blocos: lerBlocos(l.blocks),
  }));
}
