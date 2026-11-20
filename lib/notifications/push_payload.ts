import { z } from "zod";

export const PUSH_PAYLOAD_MAX = 140;

/** O que o service worker (`public/notify-sw.js`) recebe e desenha. */
export const pushPayloadSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  tag: z.string().optional(),
  /** Destino do toque na notificação inteira (= o primeiro botão). */
  href: z.string().optional(),
  icon: z.string().optional(),
  /** Até dois botões na notificação (Android e computador; o iPhone mostra só o toque). */
  acoes: z
    .array(z.object({ rotulo: z.string().min(1), href: z.string().min(1) }))
    .max(2)
    .optional(),
});

export type PushPayload = z.infer<typeof pushPayloadSchema>;

export function truncar(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= PUSH_PAYLOAD_MAX) return t;
  return `${t.slice(0, PUSH_PAYLOAD_MAX - 1)}…`;
}
