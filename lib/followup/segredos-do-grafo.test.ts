import { describe, expect, it, vi } from "vitest";

import { flowGraphSchema, type FlowGraph } from "./graph-schema";
import { temSegredoEmClaro } from "./segredo-em-claro";
import { cifrarSegredosDoGrafo } from "./segredos-do-grafo";
import { validateFlowForPublish } from "./validate-publish";

const grafo = (...acoes: Array<{ type: string; config: Record<string, unknown> }>): FlowGraph =>
  flowGraphSchema.parse({
    nodes: [
      { id: "n1", type: "trigger", label: "Gatilho", position: { x: 0, y: 0 }, config: {} },
      ...acoes.map((a, i) => ({
        id: `a${i}`,
        type: "crm_action",
        label: "Ação",
        position: { x: 0, y: 100 * (i + 1) },
        config: { action: a },
      })),
      {
        id: "fim",
        type: "end",
        label: "Fim",
        position: { x: 0, y: 900 },
        config: { outcome: "converted" },
      },
    ],
    edges: [
      { id: "g", source: "n1", target: "a0", condition: { type: "always" } },
      ...acoes.slice(1).map((_, i) => ({
        id: `e${i}`,
        source: `a${i}`,
        target: `a${i + 1}`,
        condition: { type: "always" },
      })),
      { id: "f", source: `a${acoes.length - 1}`, target: "fim", condition: { type: "always" } },
    ],
  });

const WEBHOOK = {
  type: "call_webhook",
  config: { url: "https://x.test/h", secret: "segredo-super-secreto" },
};
const TAG = { type: "add_tag", config: { tags: ["vip"] } };

describe("temSegredoEmClaro", () => {
  it("vê o segredo solto e o segredo escondido numa opção do 'a IA decide'", () => {
    expect(temSegredoEmClaro(WEBHOOK)).toBe(true);
    expect(
      temSegredoEmClaro({
        type: "call_webhook",
        config: { url: "https://x.test", secret_enc: "ab12" },
      }),
    ).toBe(false);
    expect(
      temSegredoEmClaro({
        type: "ai_decide",
        config: { opcoes: [{ id: "a", rotulo: "x", acao: WEBHOOK }] },
      }),
    ).toBe(true);
    expect(temSegredoEmClaro(TAG)).toBe(false);
  });
});

describe("cifrarSegredosDoGrafo", () => {
  it("troca o segredo em claro pelo cifrado e não mexe nos outros nós", async () => {
    const cifrar = vi.fn(
      async (_a: unknown, acoes: Array<{ type: string; config?: Record<string, unknown> }>) =>
        acoes.map((a) => {
          const { secret: _s, ...resto } = a.config ?? {};
          return { ...a, config: { ...resto, secret_enc: "cifrado-123" } };
        }),
    );

    const r = await cifrarSegredosDoGrafo({} as never, grafo(TAG, WEBHOOK), cifrar as never);

    expect(cifrar).toHaveBeenCalledTimes(1);
    const webhook = r!.nodes.find((n) => n.id === "a1");
    expect(webhook?.type === "crm_action" && webhook.config.action.config).toEqual({
      url: "https://x.test/h",
      secret_enc: "cifrado-123",
    });
    expect(JSON.stringify(r)).not.toContain("segredo-super-secreto");
    expect(r!.nodes.find((n) => n.id === "a0")).toEqual(
      grafo(TAG, WEBHOOK).nodes.find((n) => n.id === "a0"),
    );
  });

  it("sem segredo em claro, nem chama o cifrador", async () => {
    const cifrar = vi.fn();
    const g = grafo(TAG);
    expect(await cifrarSegredosDoGrafo({} as never, g, cifrar as never)).toEqual(g);
    expect(cifrar).not.toHaveBeenCalled();
  });

  it("chave de cifra indisponível devolve null — a rota recusa, nunca grava em claro", async () => {
    const r = await cifrarSegredosDoGrafo({} as never, grafo(WEBHOOK), (async () => null) as never);
    expect(r).toBeNull();
  });
});

describe("publicar com segredo em claro", () => {
  it("é recusado, apontando o nó", () => {
    const r = validateFlowForPublish(grafo(WEBHOOK), { surface: "crm_automation" });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toEqual([
        expect.objectContaining({ node_id: "a0", code: "segredo_em_claro" }),
      ]);
  });

  it("com o segredo já cifrado, publica", () => {
    const g = grafo({
      type: "call_webhook",
      config: { url: "https://x.test/h", secret_enc: "ab12" },
    });
    expect(validateFlowForPublish(g, { surface: "crm_automation" })).toEqual({ ok: true });
  });
});
