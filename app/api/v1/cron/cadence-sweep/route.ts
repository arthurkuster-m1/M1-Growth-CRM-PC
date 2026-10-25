/**
 * GET/POST /api/v1/cron/cadence-sweep — encerra as cadências esgotadas.
 *
 * Uma inscrição ativa cujo último passo já foi dado e cujo prazo de resposta venceu virou
 * "concluída": o lead não respondeu. O destino é o que a campanha escolheu no fim do desenho —
 * Perdido (a etapa de perda do funil dele) ou uma etapa à escolha. O lead só é movido se AINDA
 * está na etapa Abordagem: quem foi mexido por uma pessoa nesse meio-tempo fica onde está.
 *
 * Rodada sem efeito não audita (`tests/unit/cron-audita-so-quando-ha-efeito.test.ts`).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { autorizaCron } from "@/lib/auth/cron-auth";
import { encerrarFluxosSemResposta } from "@/lib/campanhas/fluxo-sem-resposta";
import { moverLeadParaEtapa } from "@/lib/leads/appointment-stage-move";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LOTE = 200;

export interface ResultadoDoVarredor {
  concluidas: number;
  movidos: number;
  falhas: number;
  /** Fluxos de conversa que esperavam resposta e passaram do prazo. */
  fluxosSemResposta: number;
}

export async function encerrarCadenciasEsgotadas(
  admin: ReturnType<typeof createAdminClient>,
  agora: Date,
): Promise<ResultadoDoVarredor> {
  const r: ResultadoDoVarredor = { concluidas: 0, movidos: 0, falhas: 0, fluxosSemResposta: 0 };
  const { data: vencidas } = await admin
    .from("demand_cadence_enrollments")
    .select("id, organization_id, cadence_id, lead_id, current_step")
    .eq("status", "ativa")
    .lte("next_due_at", agora.toISOString())
    .order("next_due_at", { ascending: true })
    .limit(LOTE);

  const cadencias = new Map<
    string,
    { end_action: string; end_stage_id: string | null; passos: number } | null
  >();
  for (const i of (vencidas ?? []) as Array<{
    id: string;
    organization_id: string;
    cadence_id: string;
    lead_id: string;
    current_step: number;
  }>) {
    let cad = cadencias.get(i.cadence_id);
    if (cad === undefined) {
      const { data: c } = await admin
        .from("demand_cadences")
        .select("end_action, end_stage_id")
        .eq("id", i.cadence_id)
        .eq("organization_id", i.organization_id)
        .maybeSingle();
      const { count } = await admin
        .from("demand_cadence_steps")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", i.organization_id)
        .eq("cadence_id", i.cadence_id);
      cad = c
        ? {
            end_action: (c as { end_action: string }).end_action,
            end_stage_id: (c as { end_stage_id: string | null }).end_stage_id,
            passos: count ?? 0,
          }
        : null;
      cadencias.set(i.cadence_id, cad);
    }
    // Ainda há passo a dar (só está atrasado): quem trabalha o atraso é a lista "Hoje".
    if (cad && i.current_step < cad.passos) continue;

    const { data: fechada } = await admin
      .from("demand_cadence_enrollments")
      .update({ status: "concluida", finished_at: agora.toISOString(), next_due_at: null })
      .eq("id", i.id)
      .eq("organization_id", i.organization_id)
      .eq("status", "ativa")
      .select("id");
    if ((fechada ?? []).length === 0) continue;
    r.concluidas += 1;
    if (!cad) continue;

    try {
      const { data: lead } = await admin
        .from("crm_leads")
        .select("id, pipeline_id, stage_id, contact_id, status, custom_fields, won_reason")
        .eq("id", i.lead_id)
        .eq("organization_id", i.organization_id)
        .maybeSingle();
      if (!lead || (lead as { status: string }).status !== "open") continue;
      const l = lead as {
        id: string;
        pipeline_id: string;
        stage_id: string;
        contact_id: string | null;
        status: string;
        custom_fields: Record<string, unknown> | null;
        won_reason: string | null;
      };
      const { data: atual } = await admin
        .from("crm_stages")
        .select("name, slug")
        .eq("id", l.stage_id)
        .maybeSingle();
      if ((atual as { slug?: string } | null)?.slug !== "abordagem") continue;

      const consulta = admin
        .from("crm_stages")
        .select("id, name, is_won, is_lost")
        .eq("organization_id", i.organization_id)
        .eq("pipeline_id", l.pipeline_id)
        .eq("is_archived", false);
      const { data: destino } =
        cad.end_action === "etapa" && cad.end_stage_id
          ? await consulta.eq("id", cad.end_stage_id).maybeSingle()
          : await consulta.eq("is_lost", true).limit(1).maybeSingle();
      if (!destino) {
        r.falhas += 1;
        logger.warn("[cadence-sweep] sem etapa de destino no funil do lead", { lead_id: l.id });
        continue;
      }
      const res = await moverLeadParaEtapa(admin, {
        organizationId: i.organization_id,
        leadRow: l,
        etapaRow: destino as { id: string; name: string; is_won: boolean; is_lost: boolean },
        origem: atual as { name: string },
        motivoDoMovimento: "cadencia:esgotada",
        sourceModule: "cadencia",
        actorId: "cadence-sweep",
      });
      if (res.moveu) r.movidos += 1;
      else {
        r.falhas += 1;
        logger.warn("[cadence-sweep] lead não movido", { lead_id: l.id, motivo: res.motivo });
      }
    } catch (e) {
      r.falhas += 1;
      logger.warn("[cadence-sweep] falha ao aplicar o destino", {
        lead_id: i.lead_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  r.fluxosSemResposta = await encerrarFluxosSemResposta(admin, agora);
  return r;
}

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!autorizaCron(req)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }
  let resultado: ResultadoDoVarredor;
  try {
    resultado = await encerrarCadenciasEsgotadas(createAdminClient(), new Date());
  } catch (e) {
    logger.error("[cadence-sweep] varredura falhou", {
      error: e instanceof Error ? e.message : String(e),
    });
    return fail("internal_error", "Failed to sweep cadences.", 500, { requestId });
  }
  if (resultado.concluidas > 0 || resultado.fluxosSemResposta > 0) {
    void audit({
      action: "cadence.sweep_run",
      organizationId: null,
      bypassedRls: true,
      metadata: resultado as unknown as Record<string, unknown>,
      requestId,
    });
  }
  return ok(resultado, { requestId });
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}
