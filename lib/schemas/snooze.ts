import { z } from "zod";

/**
 * O lembrete da conversa: "em 1, 3 ou 24 horas" (os atalhos) ou "em tal data e hora" (`snooze_until`,
 * ISO com fuso — o "Outro" do menu Lembrar). A data tem de estar no futuro e a, no máximo, um ano.
 */
export const snoozeSchema = z.union([
  z.object({ duration_hours: z.union([z.literal(1), z.literal(3), z.literal(24)]) }),
  z.object({ snooze_until: z.string().datetime({ offset: true }) }),
]);
export type SnoozeInput = z.infer<typeof snoozeSchema>;

export const UM_ANO_EM_MS = 366 * 24 * 3600_000;

/** O instante do lembrete, ou `null` se a data pedida não está no futuro (ou passa de um ano). */
export function instanteDoLembrete(input: SnoozeInput, agora = Date.now()): Date | null {
  if ("duration_hours" in input) return new Date(agora + input.duration_hours * 3600_000);
  const quando = new Date(input.snooze_until).getTime();
  if (!Number.isFinite(quando) || quando <= agora || quando > agora + UM_ANO_EM_MS) return null;
  return new Date(quando);
}
