/**
 * Motor único, Fase 3: o nó `crm_action` executa a ação de automação de CRM no motor de grafo.
 * Sem Postgres: dublê de `AdminClient`, no desenho de `fluxo-sem-contato-no-motor.test.ts`.
 *
 *  1. Passa pela ação: executa UMA vez, com a ação, o sujeito, o evento de origem e a posição entre as ações
 *     do fluxo; grava o resultado como evento próprio e AVANÇA.
 *  2. Ação que falha ou lança não some: o resultado fica no histórico e o fluxo segue (como as regras).
 *  3. Ação que pede para esperar (janela de envio) NÃO avança, não executa e reagenda para a hora pedida.
 *  4. Replay do mesmo passo não executa de novo (na dúvida, nunca duas mensagens).
 *  5. Sem executor no adaptador (teste puro), o nó avança e o resultado diz "executor_indisponivel".
 */
import { describe, expect, it, vi } from "vitest";

import { runFollowupTick, type AdminClient, type TickDeps } from "@/lib/followup/engine";
import { flowGraphSchema } from "@/lib/followup/graph-schema";
import type { EnrollmentRow } from "@/lib/followup/node-handlers";
import type { ItemDeAcaoDeCrm } from "@/lib/followup/acao-de-crm";
import type { ActionResultDetail } from "@/lib/automation/types";

const ORG = "11111111-1111-4111-8111-111111111111";
const LEAD = "44444444-4444-4444-8444-444444444444";
const AGORA = new Date("2026-11-21T12:00:00.000Z");

function enrollment(currentNodeId: string, extra: Partial<EnrollmentRow> = {}): EnrollmentRow {
  return {
    id: "e1",
    organization_id: ORG,
    pointer_id: "p1",
    version_id: "v1",
    contact_id: null,
    subject_kind: "lead",
    subject_id: LEAD,
    source_event_id: "ev-9",
    conversation_id: null,
    current_node_id: currentNodeId,
    status: "active",
    next_eval_at: AGORA.toISOString(),
    claimed_until: null,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    steps_taken: 0,
    outcome: null,
    cancel_reason: null,
    started_at: AGORA.toISOString(),
    completed_at: null,
    updated_at: AGORA.toISOString(),
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

const TRIGGER = { id: "n1", type: "trigger", config: {} };
const FIM = { id: "fim", type: "end", config: { outcome: "converted" } };
const crm = (id: string, type: string, config: Record<string, unknown>) => ({
  id,
  type: "crm_action",
  config: { action: { type, config } },
});
const TAG = (id = "n2") => crm(id, "add_tag", { tags: ["vip"] });

function cenario(
  g: unknown,
  fila: EnrollmentRow[],
  opcoes: {
    executar?: (item: ItemDeAcaoDeCrm) => Promise<ActionResultDetail>;
    adiar?: (item: ItemDeAcaoDeCrm) => Promise<string | null>;
    semExecutor?: boolean;
    replay?: boolean;
  } = {},
) {
  const eventos: Array<{
    event_type: string;
    node_id: string;
    payload: Record<string, unknown>;
    idempotency_key: string;
  }> = [];
  const patches: Array<Record<string, unknown>> = [];
  const executar = vi.fn(
    opcoes.executar ??
      (async (item: ItemDeAcaoDeCrm): Promise<ActionResultDetail> => ({
        type: item.action.type,
        status: "success",
      })),
  );
  const adiar = vi.fn(opcoes.adiar ?? (async () => null));
  const db: AdminClient = {
    async claimDueEnrollments() {
      return fila.splice(0, fila.length);
    },
    async loadFlowGraph() {
      return flowGraphSchema.parse(g);
    },
    async loadLeadFacts() {
      return { lead_stage: null, tags: [] };
    },
    async loadLeadFactsDoSujeito() {
      return { lead_stage: null, tags: [] };
    },
    async loadEnrollmentEvents() {
      return [];
    },
    async insertEnrollmentEvent(e) {
      eventos.push({
        event_type: e.event_type,
        node_id: e.node_id,
        payload: e.payload,
        idempotency_key: e.idempotency_key,
      });
      // o evento do PASSO é o primeiro com a chave `${nó}:${passo}`; no replay ele já existe.
      const ehDoPasso = /^[^:]+:\d+$/.test(e.idempotency_key);
      return { inserted: !(opcoes.replay && ehDoPasso) };
    },
    async updateEnrollment(_id, _org, patch) {
      patches.push(patch as Record<string, unknown>);
    },
    ...(opcoes.semExecutor ? {} : { executarAcaoDeCrm: executar, adiarAcaoDeCrm: adiar }),
    async loadLastInboundBody() {
      return null;
    },
    async loadFlowPointerName() {
      return null;
    },
    async insertDeadInboxItem() {},
    async persistirRespostaFollowup() {},
  };
  const deps: TickDeps = { db, clock: () => AGORA, enqueueJob: async () => {} };
  return { deps, eventos, patches, executar, adiar };
}

describe("nó crm_action no motor", () => {
  it("executa a ação uma vez, grava o resultado e avança", async () => {
    const c = cenario(grafo(TRIGGER, TAG(), FIM), [enrollment("n2")]);

    const resumo = await runFollowupTick(c.deps);

    expect(resumo.failed).toBe(0);
    expect(c.executar).toHaveBeenCalledTimes(1);
    expect(c.executar.mock.calls[0]![0]).toMatchObject({
      organization_id: ORG,
      enrollment_id: "e1",
      pointer_id: "p1",
      node_id: "n2",
      source_event_id: "ev-9",
      subject: { kind: "lead", id: LEAD },
      action: { type: "add_tag", config: { tags: ["vip"] } },
      indice: 0,
      acoes: [{ type: "add_tag", config: { tags: ["vip"] } }],
    });
    expect(c.eventos.map((e) => e.event_type)).toEqual(["node_advanced", "crm_action_result"]);
    expect(c.eventos[1]).toMatchObject({
      idempotency_key: "n2:0:acao",
      payload: { action_type: "add_tag", status: "success" },
    });
    expect(c.patches[0]).toMatchObject({ current_node_id: "fim", status: "active" });
  });

  it("a posição e a lista de ações seguem a ordem do grafo (id da entrega do webhook)", async () => {
    const c = cenario(
      grafo(
        TRIGGER,
        crm("a", "call_webhook", { url: "https://x.test/h" }),
        crm("b", "add_tag", { tags: ["x"] }),
        FIM,
      ),
      [enrollment("b")],
    );
    await runFollowupTick(c.deps);
    const item = c.executar.mock.calls[0]![0];
    expect(item.indice).toBe(1);
    expect(item.acoes.map((a) => a.type)).toEqual(["call_webhook", "add_tag"]);
  });

  it("ação que falha fica no histórico e o fluxo segue", async () => {
    const c = cenario(grafo(TRIGGER, TAG(), FIM), [enrollment("n2")], {
      executar: async (i) => ({ type: i.action.type, status: "failed", error: "sem_contato" }),
    });

    const resumo = await runFollowupTick(c.deps);

    expect(resumo.advanced).toBe(1);
    expect(c.eventos[1]).toMatchObject({
      event_type: "crm_action_result",
      payload: { status: "failed", error: "sem_contato" },
    });
    expect(c.patches[0]).toMatchObject({ current_node_id: "fim" });
  });

  it("ação que LANÇA vira resultado 'failed' com o motivo — e o fluxo segue", async () => {
    const c = cenario(grafo(TRIGGER, TAG(), FIM), [enrollment("n2")], {
      executar: async () => {
        throw new Error("boom");
      },
    });

    await runFollowupTick(c.deps);

    expect(c.eventos[1]).toMatchObject({ payload: { status: "failed", error: "boom" } });
    expect(c.patches[0]).toMatchObject({ current_node_id: "fim" });
  });

  it("ação que pede para esperar NÃO executa, NÃO avança e reagenda para a hora pedida", async () => {
    const ate = "2026-11-22T10:00:00.000Z";
    const c = cenario(grafo(TRIGGER, TAG(), FIM), [enrollment("n2")], { adiar: async () => ate });

    const resumo = await runFollowupTick(c.deps);

    expect(c.executar).not.toHaveBeenCalled();
    expect(resumo.advanced).toBe(0);
    expect(resumo.scheduled).toBe(1);
    expect(c.eventos).toEqual([
      {
        event_type: "crm_action_adiada",
        node_id: "n2",
        payload: { action_type: "add_tag", retry_at: ate },
        idempotency_key: `n2:0:adiada:${ate}`,
      },
    ]);
    expect(c.patches).toEqual([
      expect.objectContaining({ next_eval_at: ate, claimed_until: null }),
    ]);
    expect(c.patches[0]).not.toHaveProperty("current_node_id");
  });

  it("replay do mesmo passo não executa a ação de novo", async () => {
    const c = cenario(grafo(TRIGGER, TAG(), FIM), [enrollment("n2")], { replay: true });

    await runFollowupTick(c.deps);

    expect(c.executar).not.toHaveBeenCalled();
    expect(c.eventos.some((e) => e.event_type === "crm_action_result")).toBe(false);
  });

  it("sem executor no adaptador, o nó avança e o resultado diz 'executor_indisponivel'", async () => {
    const c = cenario(grafo(TRIGGER, TAG(), FIM), [enrollment("n2")], { semExecutor: true });

    const resumo = await runFollowupTick(c.deps);

    expect(resumo.advanced).toBe(1);
    expect(c.eventos[1]).toMatchObject({
      payload: { status: "skipped", error: "executor_indisponivel" },
    });
  });
});

describe("schema do nó crm_action", () => {
  it("recusa ação que as regras recusam", () => {
    expect(() =>
      flowGraphSchema.parse(grafo(TRIGGER, crm("n2", "add_tag", { tags: [] }), FIM)),
    ).toThrow();
    expect(() =>
      flowGraphSchema.parse(grafo(TRIGGER, crm("n2", "acao_inventada", {}), FIM)),
    ).toThrow();
  });

  it("aceita a ação no formato das regras", () => {
    expect(() => flowGraphSchema.parse(grafo(TRIGGER, TAG(), FIM))).not.toThrow();
  });
});
