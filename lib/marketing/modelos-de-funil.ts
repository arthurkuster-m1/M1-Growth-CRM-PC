import { z } from "zod";

/**
 * OS MODELOS DE FUNIL (migration 0605): a agência monta o funil uma vez e o repete em outras
 * campanhas (ex.: o mesmo funil de evento para cada turma), só mudando o nome.
 */
export const etapaDoModeloSchema = z.object({
  name: z.string().trim().min(1).max(80),
  is_won: z.boolean(),
  is_lost: z.boolean(),
  win_probability: z.number().int().min(0).max(100).nullable(),
  expected_duration_hours: z.number().int().min(1).max(8760).nullable(),
  qualification: z.enum(["mql", "disqualified"]).nullable(),
});
export type EtapaDoModelo = z.infer<typeof etapaDoModeloSchema>;

export const modeloDeFunilSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  stages: z.array(etapaDoModeloSchema),
  created_at: z.string(),
});
export type ModeloDeFunil = z.infer<typeof modeloDeFunilSchema>;

export const COLUNAS_DO_MODELO = "id, name, stages, created_at";

export const novoModeloSchema = z.object({
  name: z.string().trim().min(1).max(80),
  from_pipeline_id: z.string().uuid(),
});

export const renomearModeloSchema = z.object({ name: z.string().trim().min(1).max(80) });

export const criarFunilDaCampanhaSchema = z.object({
  template_id: z.string().uuid().nullable().optional(),
});

/** As etapas do modelo lidas do banco (jsonb), descartando o que não casa com o formato. */
export function etapasDoModelo(valor: unknown): EtapaDoModelo[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((e) => {
    const r = etapaDoModeloSchema.safeParse(e);
    return r.success ? [r.data] : [];
  });
}
