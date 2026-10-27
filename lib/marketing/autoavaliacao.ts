import { z } from "zod";

const chaveDeData = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A autoavaliação da semana: uma nota de 0 a 100 e anotações rápidas, uma por linha (tópicos). */
export const autoavaliacaoSchema = z.object({
  semana_inicio: chaveDeData,
  nota: z.number().int().min(0).max(100),
  anotacoes: z.string().max(2000),
});

export interface AutoavaliacaoDaSemana {
  semana_inicio: string;
  nota: number;
  anotacoes: string;
  updated_at: string;
}

export const COLUNAS_DA_AUTOAVALIACAO = "semana_inicio, nota, anotacoes, updated_at";

/** Os tópicos das anotações: uma linha cada, sem marcador solto e sem linha vazia. */
export function topicosDasAnotacoes(anotacoes: string): string[] {
  return anotacoes
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter((l) => l !== "");
}
