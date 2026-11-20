/**
 * Gatilho EVENTO (`trigger_config.kind='event'`) — o gatilho único das AUTOMAÇÕES DE CRM
 * (`surface='crm_automation'`), Fase 2c do motor único (docs/PLANO-MOTOR-UNICO-M1.md).
 *
 * EVENT-DRIVEN, irmão de `gatilho-lead.ts` e `gatilho-etapa.ts`, mas genérico: o fato é qualquer linha do
 * `event_log` que o motor de regras já escutava (`TRIGGER_EVENTS`). Este arquivo reaproveita as MESMAS guardas
 * do motor de regras — anti-laço (`caused_by_rule`), entidade esperada por gatilho (sem rodar 2x o mesmo fato),
 * contato pessoal e condições — e inscreve o fluxo no SUJEITO do evento (lead, contato ou compromisso), SEM
 * contato nem conversa: o envio de mensagem abre a conversa na hora (Fase 3).
 *
 * Eventos "dirigidos a uma regra" (`payload.rule_id`, a varredura de data do funil) NÃO casam aqui: pertencem às
 * regras antigas até a migração (Fase 4).
 *
 * Um fluxo vivo por (fluxo, sujeito): `23505` → `skipped_existing`. Trigger Postgres nunca faz HTTP: quem consome
 * é o drain do `event_log`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateConditions, type RuleCondition } from "@/lib/automation/conditions";
import { entidadeDoEvento } from "@/lib/automation/engine";
import { regraDoEvento } from "@/lib/automation/gatilho-de-data-do-funil";
import type { EventRow } from "@/lib/event-log/dispatcher";
import { ENTIDADE_ESPERADA_POR_GATILHO } from "@/lib/schemas/webhooks";
import { triggerConfigSchema } from "./api-schemas";
import { noDeGatilhoDoGrafo } from "./agent-followup-gate";
import { flowGraphSchema } from "./graph-schema";
import type { SujeitoDoFluxo } from "./sujeito-do-fluxo";

export interface PointerDeEvento {
  id: string;
  organization_id: string;
  active_version_id: string;
  conditions: RuleCondition[];
}

export interface GatilhoEventoDb {
  carregaPointersDeEvento(orgId: string, eventType: string): Promise<PointerDeEvento[]>;
  /** O contexto que as condições leem (lead, contato, compromisso, evento) — o mesmo do motor de regras. */
  carregaContexto(row: EventRow): Promise<Record<string, unknown>>;
  carregaNoDeGatilho(orgId: string, versionId: string): Promise<{ id: string } | null>;
  insereEnrollment(input: {
    organization_id: string;
    pointer_id: string;
    version_id: string;
    current_node_id: string;
    subject: SujeitoDoFluxo;
    source_event_id: string;
  }): Promise<{ inserted: boolean; id: string | null }>;
  insereEventoDoEnrollment(evento: {
    organization_id: string;
    enrollment_id: string;
    node_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    idempotency_key: string;
  }): Promise<void>;
}

export interface GatilhoEventoSummary {
  /** O evento é um gatilho que este motor entende (passou das guardas). */
  matched: boolean;
  motivo_de_pular?: string;
  pointers_armados: number;
  skipped_condicao: number;
  enrolled: number;
  skipped_existing: number;
}

export interface GatilhoEventoDeps {
  db: GatilhoEventoDb;
}

const vazio = (): GatilhoEventoSummary => ({
  matched: false,
  pointers_armados: 0,
  skipped_condicao: 0,
  enrolled: 0,
  skipped_existing: 0,
});

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v : null;

/** Quem é o sujeito do evento: o lead, o contato ou o compromisso a que ele se refere. */
export function sujeitoDoEvento(row: EventRow): SujeitoDoFluxo | null {
  const entidade = entidadeDoEvento(row);
  if (entidade === "crm_lead") {
    const id = texto(row.entity_id) ?? texto(row.payload?.lead_id);
    return id ? { kind: "lead", id } : null;
  }
  if (entidade === "contact") {
    const id = texto(row.entity_id);
    return id ? { kind: "contact", id } : null;
  }
  if (entidade === "calendar_appointment") {
    const id = texto(row.entity_id);
    return id ? { kind: "appointment", id } : null;
  }
  if (entidade === "message") {
    const id = texto(row.payload?.contact_id);
    return id ? { kind: "contact", id } : null;
  }
  return null;
}

export async function aplicaGatilhoDeEvento(
  deps: GatilhoEventoDeps,
  row: EventRow,
): Promise<GatilhoEventoSummary> {
  const summary = vazio();
  const pula = (motivo: string): GatilhoEventoSummary => ({ ...summary, motivo_de_pular: motivo });

  // Anti-laço: o que uma regra ou um fluxo de automação gravou não reaciona automações.
  const requestId = row.metadata?.request_id;
  if (
    row.metadata?.caused_by_rule ||
    (typeof requestId === "string" &&
      (requestId.startsWith("rule:") || requestId.startsWith("followup:")))
  ) {
    return pula("caused_by_rule");
  }

  // Evento de uma regra específica (relógio da data do funil): é das regras antigas.
  if (regraDoEvento(row.payload)) return pula("evento_dirigido_a_regra");

  const esperada = (ENTIDADE_ESPERADA_POR_GATILHO as Record<string, string>)[row.event_type];
  if (!esperada) return pula("evento_sem_gatilho");
  if (entidadeDoEvento(row) !== esperada) return pula("entity_kind_mismatch");

  const sujeito = sujeitoDoEvento(row);
  if (!sujeito) return pula("sem_sujeito");
  summary.matched = true;

  const armados = await deps.db.carregaPointersDeEvento(row.organization_id, row.event_type);
  summary.pointers_armados = armados.length;
  if (armados.length === 0) return summary;

  const contexto = await deps.db.carregaContexto(row);
  // Contato pessoal (spec 21): evento de pessoal não casa com automação nenhuma.
  if ((contexto.contact as { is_personal?: boolean } | undefined)?.is_personal === true) {
    return { ...summary, matched: false, motivo_de_pular: "contato_pessoal" };
  }

  for (const pointer of armados) {
    if (!evaluateConditions(pointer.conditions, contexto)) {
      summary.skipped_condicao++;
      continue;
    }
    const noDeGatilho = await deps.db.carregaNoDeGatilho(
      row.organization_id,
      pointer.active_version_id,
    );
    if (!noDeGatilho) continue;

    const { inserted, id } = await deps.db.insereEnrollment({
      organization_id: row.organization_id,
      pointer_id: pointer.id,
      version_id: pointer.active_version_id,
      current_node_id: noDeGatilho.id,
      subject: sujeito,
      source_event_id: row.id,
    });
    if (!inserted) {
      summary.skipped_existing++;
      continue;
    }
    summary.enrolled++;
    if (id) {
      await deps.db.insereEventoDoEnrollment({
        organization_id: row.organization_id,
        enrollment_id: id,
        node_id: noDeGatilho.id,
        event_type: "enrolled_by_event",
        payload: { event_type: row.event_type, subject_kind: sujeito.kind, event_log_id: row.id },
        idempotency_key: `gatilho-evento:${row.id}`,
      });
    }
  }
  return summary;
}

export function createSupabaseGatilhoEventoDb(
  admin: SupabaseClient,
  contexto: (row: EventRow) => Promise<Record<string, unknown>>,
): GatilhoEventoDb {
  return {
    async carregaPointersDeEvento(orgId, eventType) {
      const { data, error } = await admin
        .from("followup_flow_pointers")
        .select("id, organization_id, active_version_id, trigger_config")
        .eq("organization_id", orgId)
        .eq("surface", "crm_automation")
        .eq("status", "active")
        .not("active_version_id", "is", null);
      if (error) throw new Error(error.message);

      const pointers: PointerDeEvento[] = [];
      for (const row of (data ?? []) as Array<{
        id: string;
        organization_id: string;
        active_version_id: string | null;
        trigger_config: unknown;
      }>) {
        if (!row.active_version_id) continue;
        const parsed = triggerConfigSchema.safeParse(row.trigger_config);
        if (!parsed.success || parsed.data.kind !== "event") continue;
        if (parsed.data.params.event_type !== eventType) continue;
        pointers.push({
          id: row.id,
          organization_id: row.organization_id,
          active_version_id: row.active_version_id,
          conditions: parsed.data.params.conditions as RuleCondition[],
        });
      }
      return pointers;
    },

    carregaContexto: contexto,

    async carregaNoDeGatilho(orgId, versionId) {
      const { data, error } = await admin
        .from("followup_flow_versions")
        .select("graph")
        .eq("organization_id", orgId)
        .eq("id", versionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const no = noDeGatilhoDoGrafo(flowGraphSchema.parse(data.graph));
      return no ? { id: no.id } : null;
    },

    async insereEnrollment(input) {
      const { data, error } = await admin
        .from("followup_enrollments")
        .insert({
          organization_id: input.organization_id,
          pointer_id: input.pointer_id,
          version_id: input.version_id,
          contact_id: null,
          conversation_id: null,
          service_boundary: null,
          subject_kind: input.subject.kind,
          subject_id: input.subject.id,
          source_event_id: input.source_event_id,
          current_node_id: input.current_node_id,
          status: "active",
          // Sem horário próprio: o fluxo começa AGORA, e quem diz "agora" é o relógio do BANCO (default now()).
          agent_id: null,
        })
        .select("id")
        .maybeSingle();
      if (error) {
        if (error.code === "23505") return { inserted: false, id: null };
        throw new Error(error.message);
      }
      return { inserted: true, id: (data as { id: string } | null)?.id ?? null };
    },

    async insereEventoDoEnrollment(evento) {
      const { error } = await admin.from("followup_enrollment_events").insert(evento);
      if (error && error.code !== "23505") throw new Error(error.message);
    },
  };
}
