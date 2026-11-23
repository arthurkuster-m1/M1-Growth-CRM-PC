/**
 * GET /api/v1/cron/financas-meta
 *
 * Lê as cobranças da Meta de toda empresa que ligou um cartão da Meta nas Finanças, grava em
 * `fin_cobrancas_meta` (o gatilho lança no cartão) e avisa quem administra quando uma cobrança é
 * recusada. Roda de hora em hora (na VPS do M1: `m1-financas-meta.timer`; no scheduler do Docker, a
 * linha do entrypoint). Uma empresa por vez: a cota da Meta é escassa e a falha de uma (token vencido)
 * não derruba as outras — fica em `fin_meta_estado.ultimo_erro`.
 *
 * Auth: `Authorization: Bearer <INTERNAL_CRON_SECRET>` (fail-closed).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizaCron } from "@/lib/auth/cron-auth";
import { lerCobrancasDaMeta } from "@/lib/financas/meta-servidor";
import { logger } from "@/lib/logger";
import { ehOperante, statusDaOrgEmbutida } from "@/lib/organizacao/operante";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Por rodada; sobrou, a próxima hora pega. */
const LIMITE = 40;

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!autorizaCron(req)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fin_orcamento_config")
    .select("organization_id, organizations!inner(status)")
    .not("conta_meta_id", "is", null)
    .limit(LIMITE);
  if (error) {
    // sem a migration 0705 ainda: não há nada para ler, e isso não é falha do relógio
    if (/conta_meta_id|does not exist|schema cache/i.test(error.message)) {
      return ok({ lidas: 0, falhas: 0, motivo: "migration_0705_pendente" }, { requestId });
    }
    logger.error("[financas-meta] a consulta falhou", {
      request_id: requestId,
      error: error.message,
    });
    return fail("internal_error", "financas_meta_failed", 500, { requestId });
  }

  let lidas = 0;
  let falhas = 0;
  for (const linha of data ?? []) {
    if (!ehOperante(statusDaOrgEmbutida(linha.organizations))) continue;
    const r = await lerCobrancasDaMeta(admin, linha.organization_id as string);
    if (r.ok) lidas += 1;
    else falhas += 1;
  }
  return ok({ lidas, falhas }, { requestId });
}
