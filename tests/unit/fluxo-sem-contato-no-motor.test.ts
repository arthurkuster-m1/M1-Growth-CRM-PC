/**
 * Motor único, Fase 2b: o motor de grafo roda um fluxo SEM contato (automação de CRM, migration 0707).
 *
 * Mede, sem Postgres (dublê de `AdminClient`, o mesmo desenho de `nos-de-acao-do-followup-2065`):
 *  1. Nó interno (tag, mover etapa, tarefa) avança num fluxo sem contato: os fatos do lead vêm do
 *     SUJEITO do evento, a escrita recebe `contact_id: null` + o sujeito, e as conferências que só fazem
 *     sentido com conversa (fronteira de atendimento, agenda) NÃO são chamadas.
 *  2. Nó que fala com o cliente (`action`) falha de forma CONTROLADA: `fluxo_sem_contato`, tentativa
 *     contada, nenhum turno enfileirado — nunca avança em silêncio.
 *  3. Controle: um fluxo COM contato continua conferindo fronteira e agenda e carregando fatos pelo contato.
 */
import { describe, expect, it, vi } from "vitest";

import {
  runFollowupTick,
  type AdminClient,
  type FollowupJobRequest,
  type TickDeps,
} from "@/lib/followup/engine";
import { flowGraphSchema } from "@/lib/followup/graph-schema";
import type { EnrollmentRow } from "@/lib/followup/node-handlers";
import { ERRO_FLUXO_SEM_CONTATO, sujeitoDe } from "@/lib/followup/sujeito-do-fluxo";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTATO = "22222222-2222-4222-8222-222222222222";
const LEAD = "44444444-4444-4444-8444-444444444444";

function enrollment(currentNodeId: string, extra: Partial<EnrollmentRow> = {}): EnrollmentRow {
  return {
    id: "e1",
    organization_id: ORG,
    pointer_id: "p1",
    version_id: "v1",
    contact_id: null,
    subject_kind: "lead",
    subject_id: LEAD,
    conversation_id: null,
    current_node_id: currentNodeId,
    status: "active",
    next_eval_at: new Date().toISOString(),
    claimed_until: null,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    steps_taken: 0,
    outcome: null,
    cancel_reason: null,
    started_at: new Date().toISOString(),
    completed_at: null,
    updated_at: new Date().toISOString(),
    ...extra,
  };
}

function grafo(...nos: Array<{ id: string; type: string; config: unknown }>): unknown {
  return {
    nodes: nos.map((n, i) => ({ ...n, label: `nó ${n.id}`, position: { x: 100 * i, y: 0 } })),
    edges: nos.slice(0, -1).map((n, i) => ({
      id: `e-${n.id}-${nos[i + 1]!.id}`,
      source: n.id,
      target: nos[i + 1]!.id,
      condition: { type: "always" },
    })),
  };
}

const NO_TRIGGER = { id: "n1", type: "trigger", config: {} };
const NO_FIM = { id: "fim", type: "end", config: { outcome: "converted" } };

function cenario(g: unknown, fila: EnrollmentRow[]) {
  const patches: Array<Record<string, unknown>> = [];
  const jobs: FollowupJobRequest[] = [];
  const editar: unknown[] = [];
  const espioes = {
    assertServiceBoundary: vi.fn(async () => {}),
    assertAgenda: vi.fn(async () => {}),
    loadLeadFacts: vi.fn(async () => ({ lead_stage: "contato", tags: [], custom_fields: {} })),
    loadLeadFactsDoSujeito: vi.fn(async () => ({
      lead_stage: "sujeito",
      tags: ["x"],
      custom_fields: {},
    })),
  };
  const db: AdminClient = {
    ...espioes,
    async claimDueEnrollments() {
      return fila.splice(0, fila.length);
    },
    async loadFlowGraph() {
      return flowGraphSchema.parse(g);
    },
    async loadEnrollmentEvents() {
      return [];
    },
    async insertEnrollmentEvent() {
      return { inserted: true };
    },
    async updateEnrollment(_id, _org, patch) {
      patches.push(patch as Record<string, unknown>);
    },
    async editarTagDoLead(item) {
      editar.push(item);
    },
    async loadLastInboundBody() {
      return null;
    },
    async loadFlowPointerName() {
      return null;
    },
    async insertDeadInboxItem() {},
    async persistirRespostaFollowup() {},
  };
  const deps: TickDeps = {
    db,
    clock: () => new Date("2026-11-20T12:00:00.000Z"),
    enqueueJob: async (job) => {
      jobs.push(job);
    },
  };
  return { deps, patches, jobs, editar, espioes };
}

describe("motor — fluxo sem contato (automação de CRM)", () => {
  it("nó interno avança pelo sujeito do evento, sem conferir fronteira nem agenda", async () => {
    const c = cenario(
      grafo(NO_TRIGGER, { id: "n2", type: "edit_lead_tag", config: { tags: ["vip"] } }, NO_FIM),
      [enrollment("n2")],
    );

    const resumo = await runFollowupTick(c.deps);

    expect(resumo.failed).toBe(0);
    expect(resumo.advanced).toBe(1);
    expect(c.editar).toHaveLength(1);
    expect(c.editar[0]).toMatchObject({
      organization_id: ORG,
      contact_id: null,
      subject: { kind: "lead", id: LEAD },
      config: { tags: ["vip"] },
    });
    expect(c.espioes.loadLeadFactsDoSujeito).toHaveBeenCalledWith(ORG, { kind: "lead", id: LEAD });
    expect(c.espioes.loadLeadFacts).not.toHaveBeenCalled();
    expect(c.espioes.assertServiceBoundary).not.toHaveBeenCalled();
    expect(c.espioes.assertAgenda).not.toHaveBeenCalled();
    expect(c.patches[0]).toMatchObject({ current_node_id: "fim", status: "active" });
  });

  it("nó que fala com o cliente falha de forma controlada e não enfileira turno", async () => {
    const c = cenario(
      grafo(NO_TRIGGER, { id: "n2", type: "action", config: { mode: "text", body: "oi" } }, NO_FIM),
      [enrollment("n2")],
    );

    const resumo = await runFollowupTick(c.deps);

    expect(resumo.failed).toBe(1);
    expect(c.jobs).toEqual([]);
    expect(c.patches[0]).toMatchObject({ attempts: 1, last_error: ERRO_FLUXO_SEM_CONTATO });
  });

  it("esgotadas as tentativas, morre com o motivo — nunca avança calado", async () => {
    const c = cenario(
      grafo(NO_TRIGGER, { id: "n2", type: "action", config: { mode: "text", body: "oi" } }, NO_FIM),
      [enrollment("n2", { attempts: 3, max_attempts: 3 })],
    );

    const resumo = await runFollowupTick(c.deps);

    expect(resumo.dead).toBe(1);
    expect(c.jobs).toEqual([]);
    expect(c.patches[0]).toMatchObject({ status: "dead" });
  });

  it("controle: fluxo COM contato continua conferindo fronteira, agenda e fatos pelo contato", async () => {
    const c = cenario(
      grafo(NO_TRIGGER, { id: "n2", type: "edit_lead_tag", config: { tags: ["vip"] } }, NO_FIM),
      [enrollment("n2", { contact_id: CONTATO, subject_kind: null, subject_id: null })],
    );

    const resumo = await runFollowupTick(c.deps);

    expect(resumo.failed).toBe(0);
    expect(c.espioes.assertServiceBoundary).toHaveBeenCalled();
    expect(c.espioes.assertAgenda).toHaveBeenCalled();
    expect(c.espioes.loadLeadFacts).toHaveBeenCalledWith(ORG, CONTATO);
    expect(c.espioes.loadLeadFactsDoSujeito).not.toHaveBeenCalled();
    expect(c.editar[0]).toMatchObject({ contact_id: CONTATO, subject: null });
  });
});

describe("sujeitoDe", () => {
  it("só devolve sujeito quando tipo e id vêm juntos", () => {
    expect(sujeitoDe({ subject_kind: "lead", subject_id: LEAD })).toEqual({
      kind: "lead",
      id: LEAD,
    });
    expect(sujeitoDe({ subject_kind: "lead", subject_id: null })).toBeNull();
    expect(sujeitoDe({})).toBeNull();
  });
});
