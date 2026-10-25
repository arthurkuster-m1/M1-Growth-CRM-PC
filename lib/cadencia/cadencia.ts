import { z } from "zod";

import { MEIOS_DA_ABORDAGEM } from "@/lib/marketing/abordagens";

/**
 * A CADÊNCIA da campanha de prospecção (migration 0659): a lista de passos "no dia D+N, por tal
 * meio, com tal abordagem" que se repete em cada lead que entra na etapa Abordagem.
 *
 * ⚠️ A FORMA destas listas é requisito do extrator de `vocabulario-banco-x-typescript`.
 */
export const STATUS_DA_INSCRICAO = ["ativa", "respondeu", "concluida", "cancelada"] as const;
export type StatusDaInscricao = (typeof STATUS_DA_INSCRICAO)[number];

export const DESTINOS_DO_FIM = ["perdido", "etapa"] as const;
export type DestinoDoFim = (typeof DESTINOS_DO_FIM)[number];

/** Depois do último passo o lead ainda tem este prazo para responder antes de a cadência acabar. */
export const DIAS_PARA_RESPONDER_DEPOIS_DO_ULTIMO_PASSO = 2;
export const MAXIMO_DE_PASSOS = 30;

export const passoSchema = z.object({
  day_offset: z.number().int().min(0).max(365),
  medium: z.enum(MEIOS_DA_ABORDAGEM),
  approach_id: z.string().uuid().nullable(),
  note: z.string().trim().max(500),
});
export type PassoDaCadencia = z.infer<typeof passoSchema>;

export const cadenciaSchema = z
  .object({
    end_action: z.enum(DESTINOS_DO_FIM),
    end_stage_id: z.string().uuid().nullable(),
    steps: z.array(passoSchema).max(MAXIMO_DE_PASSOS),
  })
  .refine((v) => v.end_action !== "etapa" || v.end_stage_id !== null, {
    message: "Escolha a etapa de destino.",
    path: ["end_stage_id"],
  });
export type EntradaDaCadencia = z.infer<typeof cadenciaSchema>;

export const novoModeloSchema = z.object({
  name: z.string().trim().min(1).max(160),
  campaign_id: z.string().uuid(),
});

export interface CadenciaDaCampanha {
  id: string | null;
  end_action: DestinoDoFim;
  end_stage_id: string | null;
  steps: Array<PassoDaCadencia & { id: string }>;
  /** Inscrições ativas agora. */
  ativos: number;
  /** Quantos leads estão em cada passo (índice = posição do passo); depois do último, em `aguardando`. */
  por_passo: number[];
  /** Leads que deram o último passo e estão no prazo de resposta. */
  aguardando: number;
  /** O funil da campanha (para abrir as oportunidades filtradas no CRM). */
  funil_id: string | null;
}

export interface ModeloDeCadencia {
  id: string;
  name: string;
  passos: number;
}

/** Passos em ordem: pelo dia e, no mesmo dia, pela posição gravada. */
export function ordenarPassos<T extends { day_offset: number }>(passos: readonly T[]): T[] {
  return passos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p.day_offset - b.p.day_offset || a.i - b.i)
    .map((x) => x.p);
}

const DIA_MS = 86_400_000;

/**
 * Onde a inscrição fica depois que o passo `feito` (índice) foi registrado sem resposta: o
 * próximo passo vence em `iniciouEm + dia do passo`; passado o último, o lead ganha um prazo para
 * responder e então o cron encerra a cadência.
 */
export function aposRegistrarPasso(
  passos: readonly { day_offset: number }[],
  feito: number,
  iniciouEm: Date,
  agora: Date,
): { current_step: number; next_due_at: Date } {
  const proximo = feito + 1;
  if (proximo < passos.length) {
    return {
      current_step: proximo,
      next_due_at: new Date(iniciouEm.getTime() + passos[proximo]!.day_offset * DIA_MS),
    };
  }
  return {
    current_step: passos.length,
    next_due_at: new Date(agora.getTime() + DIAS_PARA_RESPONDER_DEPOIS_DO_ULTIMO_PASSO * DIA_MS),
  };
}
