import { describe, expect, it } from "vitest";

import { flowGraphSchema, type FlowGraph } from "./graph-schema";
import { validateFlowForPublish } from "./validate-publish";

function grafo(action: { type: string; config: Record<string, unknown> }): FlowGraph {
  return flowGraphSchema.parse({
    nodes: [
      { id: "n1", type: "trigger", label: "Gatilho", position: { x: 0, y: 0 }, config: {} },
      {
        id: "n2",
        type: "crm_action",
        label: "Ação",
        position: { x: 0, y: 100 },
        config: { action },
      },
      {
        id: "fim",
        type: "end",
        label: "Fim",
        position: { x: 0, y: 200 },
        config: { outcome: "converted" },
      },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2", condition: { type: "always" } },
      { id: "e2", source: "n2", target: "fim", condition: { type: "always" } },
    ],
  });
}

const TAG = { type: "add_tag", config: { tags: ["vip"] } };
const ATRIBUIR = {
  type: "assign_owner",
  config: { user_id: "11111111-1111-4111-8111-111111111111" },
};

describe("publicar um fluxo com nó crm_action", () => {
  it("passa na superfície de automação de CRM", () => {
    expect(validateFlowForPublish(grafo(TAG), { surface: "crm_automation" })).toEqual({ ok: true });
  });

  it("é recusado no follow-up e no roteiro de atendimento (o motor deles não o executa)", () => {
    for (const surface of ["followup", "atendimento"] as const) {
      const r = validateFlowForPublish(grafo(TAG), { surface });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.map((e) => e.node_id)).toContain("n2");
    }
  });

  it("recusa a ação que regravaria o lead e reabriria o próprio gatilho", () => {
    const r = validateFlowForPublish(grafo(ATRIBUIR), {
      surface: "crm_automation",
      eventoDoGatilho: "lead.assigned",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual([
        expect.objectContaining({ node_id: "n2", code: "acao_fecha_laco" }),
      ]);
    }
  });

  it("a mesma ação é aceita num gatilho em que não há laço", () => {
    expect(
      validateFlowForPublish(grafo(ATRIBUIR), {
        surface: "crm_automation",
        eventoDoGatilho: "message.received",
      }),
    ).toEqual({ ok: true });
  });

  it("sem o evento do gatilho a conferência de laço não roda (nunca adivinha)", () => {
    expect(validateFlowForPublish(grafo(ATRIBUIR), { surface: "crm_automation" })).toEqual({
      ok: true,
    });
  });
});
