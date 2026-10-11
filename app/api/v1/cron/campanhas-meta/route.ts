/**
 * GET /api/v1/cron/campanhas-meta
 *
 * Puxa o dia a dia do Meta de todas as campanhas de demanda que têm campanhas do Meta atreladas
 * e estão planejadas, ativas ou pausadas (encerradas param de puxar; um clique no botão da tela
 * ainda atualiza). Roda de hora em hora (na VPS do M1: `m1-campanhas-meta.timer`).
 *
 * Uma campanha por vez, em série: a cota do Meta é o recurso escasso, e uma falha de uma
 * organização (token vencido) não derruba as outras — fica registrada em `meta_sync_error`.
 *
 * Auth: `Authorization: Bearer <INTERNAL_CRON_SECRET>` (fail-closed).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizaCron } from "@/lib/auth/cron-auth";
import { logger } from "@/lib/logger";
import { campanhaDaLinha } from "@/lib/marketing/campanhas";
import { sincronizarCampanhaComMeta } from "@/lib/marketing/campanhas-meta-servidor";
import { ehOperante, statusDaOrgEmbutida } from "@/lib/organizacao/operante";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Por rodada. A mais antiga sincronizada vai primeiro; sobrou, a próxima hora pega. */
const LIMITE = 40;

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!autorizaCron(req)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("demand_campaigns")
    .select(
      "id, organization_id, start_date, end_date, meta_account_id, platform_campaigns, organizations!inner(status)",
    )
    .in("status", ["planejada", "ativa", "pausada"])
    .not("platform_campaigns", "eq", "[]")
    .order("meta_synced_at", { ascending: true, nullsFirst: true })
    .limit(LIMITE);
  if (error) {
    logger.error("[campanhas-meta] a consulta falhou", {
      request_id: requestId,
      error: error.message,
    });
    return fail("internal_error", "campanhas_meta_failed", 500, { requestId });
  }

  let sincronizadas = 0;
  let falhas = 0;
  for (const linha of data ?? []) {
    if (!ehOperante(statusDaOrgEmbutida(linha.organizations))) continue;
    const c = campanhaDaLinha(linha as Record<string, unknown>);
    if (!c.platform_campaigns.some((p) => p.id)) continue;
    const r = await sincronizarCampanhaComMeta(admin, {
      id: c.id,
      organization_id: linha.organization_id as string,
      start_date: c.start_date,
      end_date: c.end_date,
      meta_account_id: c.meta_account_id ?? "",
      platform_campaigns: c.platform_campaigns,
    });
    if (r.ok) sincronizadas += 1;
    else falhas += 1;
  }
  return ok({ sincronizadas, falhas }, { requestId });
}
