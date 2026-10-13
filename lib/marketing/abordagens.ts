import { z } from "zod";

/**
 * AS ABORDAGENS (migration 0602): nas campanhas de contato direto, o que o criativo é para o
 * anúncio — o meio, o gancho, a mensagem e o follow-up que a equipe usa.
 *
 * ⚠️ A FORMA de `MEIOS_DA_ABORDAGEM` é requisito de instrumento (extrator de
 * `vocabulario-banco-x-typescript`). O status reaproveita os do criativo (ativo/pausado/encerrado).
 */
export const MEIOS_DA_ABORDAGEM = [
  "whatsapp",
  "ligacao",
  "email",
  "linkedin",
  "instagram",
  "presencial",
  "outro",
] as const;
export type MeioDaAbordagem = (typeof MEIOS_DA_ABORDAGEM)[number];

export const STATUS_DA_ABORDAGEM = ["ativo", "pausado", "encerrado"] as const;
export type StatusDaAbordagem = (typeof STATUS_DA_ABORDAGEM)[number];

export interface Abordagem {
  id: string;
  campaign_id: string;
  name: string;
  status: StatusDaAbordagem;
  medium: MeioDaAbordagem;
  audience: string;
  hook: string;
  script: string;
  follow_up: string;
  notes: string;
  position: number;
  created_at: string;
}

export const COLUNAS_DA_ABORDAGEM =
  "id, campaign_id, name, status, medium, audience, hook, script, follow_up, notes, position, created_at";

const camposSchema = z.object({
  name: z.string().trim().min(1).max(160),
  status: z.enum(STATUS_DA_ABORDAGEM),
  medium: z.enum(MEIOS_DA_ABORDAGEM),
  audience: z.string().trim().max(500),
  hook: z.string().trim().max(500),
  script: z.string().trim().max(6000),
  follow_up: z.string().trim().max(6000),
  notes: z.string().trim().max(2000),
  position: z.number().finite(),
});

export const novaAbordagemSchema = camposSchema.partial().required({ name: true });
export const edicaoDeAbordagemSchema = camposSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

export function abordagemDaLinha(l: Record<string, unknown>): Abordagem {
  return { ...(l as unknown as Abordagem), position: Number(l.position) || 0 };
}
