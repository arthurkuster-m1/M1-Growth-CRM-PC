/**
 * GET /api/v1/cron/tarefas-repetidas
 *
 * Cria as tarefas dos modelos que REPETEM (migration 0586): para cada modelo com
 * `repeat_enabled` e `next_run_at` vencido, cria a tarefa e agenda a próxima ocorrência.
 * Chamada por um timer a cada poucos minutos (na VPS do M1: `m1-tarefas-repetidas.timer`).
 *
 * ─── Como não criar a mesma tarefa duas vezes
 *
 * O modelo é REIVINDICADO antes de a tarefa existir: um UPDATE que troca `next_run_at` pelo
 * valor futuro, condicionado ao `next_run_at` antigo. Duas rodadas ao mesmo tempo disputam
 * a mesma linha e só uma a leva; a outra vê 0 linhas e pula. Se a criação falha depois da
 * reivindicação, o `next_run_at` volta ao valor antigo e a próxima rodada tenta de novo.
 *
 * ─── Servidor parado
 *
 * Se o servidor ficou fora do ar e perdeu várias ocorrências, cria UMA tarefa e pula para a
 * próxima futura — não despeja dez tarefas iguais de uma vez. O "hoje" da tarefa é o dia
 * agendado se a rodada atrasou menos de 24 h; passado disso, é o dia de hoje.
 *
 * Organização parada (suspensa, arquivada) não recebe tarefa nova.
 *
 * Auth: `Authorization: Bearer <INTERNAL_CRON_SECRET>` (fail-closed).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { autorizaCron } from "@/lib/auth/cron-auth";
import { chaveDoDia } from "@/lib/inicio/datas";
import { logger } from "@/lib/logger";
import { ehOperante, statusDaOrgEmbutida } from "@/lib/organizacao/operante";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COLUNAS_DO_MODELO,
  proximaExecucao,
  tarefaDoModelo,
  type ModeloDeTarefa,
} from "@/lib/tarefas/modelos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Por rodada. Sobrou? A próxima rodada (poucos minutos depois) pega. */
const LIMITE = 100;
const UM_DIA_MS = 86_400_000;
const FUSO_PADRAO = "America/Sao_Paulo";

type LinhaDoModelo = ModeloDeTarefa & {
  created_by: string | null;
  organizations:
    | { status: string; timezone: string | null }
    | Array<{ status: string; timezone: string | null }>
    | null;
};

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!autorizaCron(req)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  const admin = createAdminClient();
  const agora = new Date();

  const { data, error } = await admin
    .from("crm_task_templates")
    .select(`${COLUNAS_DO_MODELO}, created_by, organizations!inner(status, timezone)`)
    .eq("repeat_enabled", true)
    .lte("next_run_at", agora.toISOString())
    .order("next_run_at", { ascending: true })
    .limit(LIMITE);

  if (error) {
    logger.error("[tarefas-repetidas] a consulta falhou", {
      request_id: requestId,
      error: error.message,
    });
    return fail("internal_error", "tarefas_repetidas_failed", 500, { requestId });
  }

  const resultado = { criadas: 0, puladas: 0, falhas: 0 };
  const criadas: Array<{ id: string; modelo: LinhaDoModelo }> = [];

  for (const linha of (data ?? []) as unknown as LinhaDoModelo[]) {
    const org = Array.isArray(linha.organizations) ? linha.organizations[0] : linha.organizations;
    // Organização parada: nada de tarefa nova (e o modelo espera, vencido, até ela voltar).
    if (!ehOperante(statusDaOrgEmbutida(linha.organizations as never))) {
      resultado.puladas += 1;
      continue;
    }
    const fuso = org?.timezone || FUSO_PADRAO;
    const agendado = new Date(linha.next_run_at!);
    const proxima = proximaExecucao(linha, agora, fuso);

    // 1. Reivindica: só uma rodada leva a linha.
    const { data: levou } = await admin
      .from("crm_task_templates")
      .update({
        last_run_at: agora.toISOString(),
        next_run_at: proxima ? proxima.toISOString() : null,
      })
      .eq("id", linha.id)
      .eq("next_run_at", linha.next_run_at!)
      .select("id");
    if (!levou || levou.length === 0) {
      resultado.puladas += 1;
      continue;
    }

    // 2. Cria a tarefa.
    const base = chaveDoDia(
      agora.getTime() - agendado.getTime() < UM_DIA_MS ? agendado : agora,
      fuso,
    );
    const tarefa = tarefaDoModelo(linha, base, fuso);
    const { data: criada, error: erroDeCriacao } = await admin
      .from("crm_tasks")
      .insert({ ...tarefa, organization_id: linha.organization_id, created_by: linha.created_by })
      .select("id")
      .single();

    if (erroDeCriacao || !criada) {
      logger.error("[tarefas-repetidas] não criou a tarefa", {
        request_id: requestId,
        modelo: linha.id,
        error: erroDeCriacao?.message,
      });
      // Devolve a ocorrência: a próxima rodada tenta de novo.
      const devolver = admin
        .from("crm_task_templates")
        .update({ next_run_at: linha.next_run_at, last_run_at: linha.last_run_at })
        .eq("id", linha.id);
      await (proxima
        ? devolver.eq("next_run_at", proxima.toISOString())
        : devolver.is("next_run_at", null));
      resultado.falhas += 1;
      continue;
    }

    resultado.criadas += 1;
    criadas.push({ id: (criada as { id: string }).id, modelo: linha });
  }

  // Auditoria só quando houve efeito: uma rodada vazia (quase todas) não grava nada.
  if (criadas.length > 0) {
    for (const { id, modelo } of criadas) {
      void audit({
        organizationId: modelo.organization_id,
        actorUserId: null,
        bypassedRls: true,
        action: "crm_task.created",
        resourceType: "crm_tasks",
        resourceId: id,
        requestId,
        metadata: { origem: "modelo_repetido", modelo_id: modelo.id, modelo: modelo.name },
      });
    }
  }

  if (resultado.criadas + resultado.falhas > 0) {
    logger.info("[tarefas-repetidas] rodada", { request_id: requestId, ...resultado });
  }
  return ok(resultado, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  return GET(req);
}
