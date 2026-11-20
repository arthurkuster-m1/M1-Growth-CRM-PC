import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { vapidPronto, vapidPublica, vapidSubject } from "./vapid";
import type { PushPayload } from "./push_payload";

export type PushSubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Manda o push SÓ para os aparelhos destas pessoas, nesta organização.
 *
 * Não existe mais "mandar para a organização inteira": quem decide os destinatários é
 * `montar-avisos.ts` (o responsável pela conversa/lead, ou a equipe que distribui). Inscrição
 * que o navegador declarou morta (404/410) é apagada no caminho.
 */
export async function enviarPushAosUsuarios(
  organizationId: string,
  userIds: readonly string[],
  payload: PushPayload,
): Promise<{ sent: number; gone: number }> {
  if (!vapidPronto() || userIds.length === 0) return { sent: 0, gone: 0 };
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("organization_id", organizationId)
    .in("user_id", [...new Set(userIds)]);
  if (error) {
    logger.warn("push_subscriptions_list_failed", { detail: error.message });
    return { sent: 0, gone: 0 };
  }
  const rows = (data ?? []) as PushSubRow[];
  if (rows.length === 0) return { sent: 0, gone: 0 };

  webpush.setVapidDetails(await vapidSubject(), vapidPublica()!, env.VAPID_PRIVATE_KEY.trim());

  let sent = 0;
  let gone = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          gone += 1;
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("organization_id", organizationId)
            .eq("id", row.id);
          return;
        }
        logger.warn("web_push_send_failed", { status: status ?? 0 });
      }
    }),
  );

  return { sent, gone };
}
