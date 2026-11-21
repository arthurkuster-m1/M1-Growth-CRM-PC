/**
 * Executa o nó `crm_action` (motor único, Fase 3 — docs/PLANO-MOTOR-UNICO-M1.md): a MESMA ação registrada em
 * `lib/automation/actions/` que as regras já executam, com o contexto que elas esperam (evento de origem, lead,
 * contato). Nada de envio é reescrito aqui: janela do canal, limite diário, ritmo, trava de contato pessoal,
 * guarda de consentimento e a fronteira de atendimento (a conversa abre/reaproveita NA HORA de enviar) vivem
 * nas ações.
 *
 * Carregado por `import()` dinâmico em `engine.ts`: o registro de ações puxa o caminho de envio inteiro, e o
 * motor de follow-up não deve carregá-lo para quem nunca roda uma automação de CRM.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAction } from "@/lib/automation/actions";
import "@/lib/automation/actions/register-all";
import { buildContext } from "@/lib/automation/engine";
import type { ActionCtx, ActionResultDetail } from "@/lib/automation/types";
import type { EventRow } from "@/lib/event-log/dispatcher";
import { acoesQueFechamLaco } from "@/lib/schemas/webhooks";
import type { SujeitoDoFluxo } from "./sujeito-do-fluxo";

export interface ItemDeAcaoDeCrm {
  organization_id: string;
  enrollment_id: string;
  pointer_id: string;
  node_id: string;
  /** O evento do `event_log` que iniciou o fluxo. */
  source_event_id: string | null;
  subject: SujeitoDoFluxo | null;
  action: { type: string; config: Record<string, unknown> };
  /** Posição desta ação entre as ações do fluxo (compõe o id da entrega do webhook de saída). */
  indice: number;
  /** TODAS as ações do fluxo, na ordem do grafo — também entram no id da entrega do webhook. */
  acoes: ReadonlyArray<{ type: string; config: Record<string, unknown> }>;
}

export const ERRO_EVENTO_DE_ORIGEM_INDISPONIVEL = "evento_de_origem_indisponivel";

async function eventoDeOrigem(
  admin: SupabaseClient,
  item: ItemDeAcaoDeCrm,
): Promise<EventRow | null> {
  if (!item.source_event_id) return null;
  const { data, error } = await admin
    .from("event_log")
    .select("*")
    .eq("organization_id", item.organization_id)
    .eq("id", item.source_event_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventRow | null) ?? null;
}

async function montaCtx(
  admin: SupabaseClient,
  item: ItemDeAcaoDeCrm,
  row: EventRow,
): Promise<ActionCtx> {
  const { data } = await admin
    .from("followup_flow_pointers")
    .select("name")
    .eq("organization_id", item.organization_id)
    .eq("id", item.pointer_id)
    .maybeSingle();
  return {
    admin,
    serviceBoundaries: new Map(),
    organizationId: item.organization_id,
    // `followup:<inscrição>`: a marca anti-laço (`caused_by_rule`, `request_id=rule:followup:…`) que o gatilho
    // por evento reconhece, e um id estável por inscrição para o rastro e a entrega do webhook.
    ruleId: `followup:${item.enrollment_id}`,
    ruleName: (data as { name?: string } | null)?.name ?? "Automação",
    event: row,
    context: await buildContext(admin, row),
    requestId: `${item.enrollment_id}:${item.node_id}`,
    actionIndex: item.indice,
    ruleActions: item.acoes,
  };
}

/**
 * Até quando a ação pede para esperar (ISO), ou `null` se pode rodar agora — a janela de envio do número, o
 * limite diário. Consultado ANTES de executar: um envio fora da janela não pode avançar o fluxo como feito.
 */
export async function adiarAcaoDeCrm(
  admin: SupabaseClient,
  item: ItemDeAcaoDeCrm,
): Promise<string | null> {
  const executor = getAction(item.action.type);
  if (!executor?.postponeUntil) return null;
  const row = await eventoDeOrigem(admin, item);
  if (!row) return null;
  return executor.postponeUntil(await montaCtx(admin, item, row), item.action.config);
}

export async function executarAcaoDeCrm(
  admin: SupabaseClient,
  item: ItemDeAcaoDeCrm,
): Promise<ActionResultDetail> {
  const { type, config } = item.action;
  const executor = getAction(type);
  if (!executor) return { type, status: "failed", error: "unknown_action" };

  const row = await eventoDeOrigem(admin, item);
  if (!row) return { type, status: "failed", error: ERRO_EVENTO_DE_ORIGEM_INDISPONIVEL };

  // Defesa em profundidade do veto de #1528 (o publicar já o aplica): regravar o lead reemitiria o gatilho.
  if (acoesQueFechamLaco(row.event_type, [item.action]).length) {
    return { type, status: "skipped", error: "acao_fecharia_laco" };
  }
  return executor.execute(await montaCtx(admin, item, row), config);
}
