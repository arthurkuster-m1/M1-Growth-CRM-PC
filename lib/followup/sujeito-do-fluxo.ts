/**
 * O SUJEITO DO FLUXO (motor único, Fase 2b — docs/PLANO-MOTOR-UNICO-M1.md).
 *
 * Um fluxo de follow-up é do CONTATO. Um fluxo de automação de CRM (`surface='crm_automation'`) é do
 * OBJETO DO EVENTO — um lead, um contato ou um compromisso — e pode não ter contato nem conversa
 * (migration 0701). Este arquivo é o único lugar que diz o que isso muda para o motor.
 */
import type { NodeType } from "./graph-schema";
import type { EnrollmentRow } from "./node-handlers";

export interface SujeitoDoFluxo {
  kind: "lead" | "contact" | "appointment";
  id: string;
}

/** O erro de um nó que precisa do cliente num fluxo que não tem contato. Vira `last_error`/aviso na Central. */
export const ERRO_FLUXO_SEM_CONTATO = "fluxo_sem_contato";

/**
 * Os nós que falam com o cliente ou esperam a resposta dele: precisam de contato E de conversa.
 * Num fluxo sem contato falham de forma CONTROLADA (retentam e morrem com aviso), nunca em silêncio.
 * O envio de mensagem por fluxo de automação (abrir a conversa na hora de enviar) é a Fase 3.
 */
export const NOS_QUE_EXIGEM_CONTATO: readonly NodeType[] = [
  "action",
  "ai_classify",
  "match_reply",
  "collect",
  "skill",
];

export function exigeContato(tipo: NodeType): boolean {
  return NOS_QUE_EXIGEM_CONTATO.includes(tipo);
}

/** O sujeito gravado na inscrição, ou `null` (fluxo de follow-up comum, sem sujeito). */
export function sujeitoDe(
  e: Pick<EnrollmentRow, "subject_kind" | "subject_id">,
): SujeitoDoFluxo | null {
  return e.subject_kind && e.subject_id ? { kind: e.subject_kind, id: e.subject_id } : null;
}

/** Fluxo sem contato: não tem fronteira de atendimento nem proteção de agenda para conferir. */
export function semContato(e: Pick<EnrollmentRow, "contact_id">): boolean {
  return e.contact_id === null;
}
