import { describe, expect, it } from "vitest";

import { MODELOS_DA_CENTRAL } from "@/lib/automation/modelos-prontos";
import { triggerConfigSchema } from "./api-schemas";
import { regraParaFluxo, type RegraParaConverter } from "./regra-para-fluxo";

const USUARIO = "11111111-1111-4111-8111-111111111111";

const regra = (extra: Partial<RegraParaConverter> = {}): RegraParaConverter => ({
  name: "Boas-vindas",
  trigger_event: "lead.tag_added",
  conditions: [{ field: "lead.tags", op: "contains", value: "Google" }],
  actions: [
    { type: "add_tag", config: { tags: ["Novo"] } },
    {
      type: "create_task",
      config: {
        titulo: "Ligar",
        vence_em_dias: 1,
        atribuir_a: "dono_do_lead",
        prioridade: "medium",
      },
    },
  ],
  ...extra,
});

describe("regraParaFluxo", () => {
  it("vira gatilho 'event' com as condições, uma ação por nó em cadeia, e fim", () => {
    const r = regraParaFluxo(regra());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.nome).toBe("Boas-vindas");
    expect(triggerConfigSchema.parse(r.trigger_config)).toMatchObject({
      kind: "event",
      params: {
        event_type: "lead.tag_added",
        conditions: [{ field: "lead.tags", op: "contains", value: "Google" }],
      },
    });
    expect(r.graph.nodes.map((n) => [n.id, n.type])).toEqual([
      ["gatilho", "trigger"],
      ["acao-1", "crm_action"],
      ["acao-2", "crm_action"],
      ["fim", "end"],
    ]);
    expect(r.graph.edges.map((e) => [e.source, e.target])).toEqual([
      ["gatilho", "acao-1"],
      ["acao-1", "acao-2"],
      ["acao-2", "fim"],
    ]);
  });

  it("copia o config de cada ação VERBATIM, inclusive o segredo já cifrado do webhook", () => {
    const acao = {
      type: "call_webhook",
      config: { url: "https://x.test/h", secret_enc: "ab12cd", include_owner: true },
    };
    const r = regraParaFluxo(regra({ trigger_event: "lead.won", actions: [acao] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const no = r.graph.nodes.find((n) => n.id === "acao-1");
    expect(no?.type === "crm_action" && no.config.action).toEqual(acao);
  });

  it("leva os parâmetros do gatilho por tempo para params.config", () => {
    const r = regraParaFluxo(
      regra({
        trigger_event: "lead.silent_for",
        trigger_config: { dias: 3, unidade: "dias", direcao: "do_cliente" },
        conditions: [],
        actions: [{ type: "add_tag", config: { tags: ["Esfriou"] } }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(triggerConfigSchema.parse(r.trigger_config)).toMatchObject({
      params: {
        event_type: "lead.silent_for",
        config: { dias: 3, unidade: "dias", direcao: "do_cliente" },
      },
    });
  });

  it("regra sem ação converte num fluxo só com gatilho e fim", () => {
    const r = regraParaFluxo(regra({ actions: [] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.graph.nodes.map((n) => n.id)).toEqual(["gatilho", "fim"]);
  });

  it("a IA decide converte como qualquer outra ação (o config inteiro, com as opções)", () => {
    const ia = {
      type: "ai_decide",
      config: {
        custo_de_token: true,
        instrucao: "Decida",
        opcoes: [
          { id: "a", rotulo: "Comprar", acao: { type: "add_tag", config: { tags: ["quente"] } } },
          { id: "b", rotulo: "Curioso", acao: { type: "add_tag", config: { tags: ["frio"] } } },
        ],
      },
    };
    const r = regraParaFluxo(
      regra({ trigger_event: "message.received", conditions: [], actions: [ia] }),
    );
    expect(r.ok).toBe(true);
  });

  it("não converte regra com gatilho que o motor não conhece", () => {
    const r = regraParaFluxo(regra({ trigger_event: "lead.inventado" }));
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.motivo).toMatch(/^gatilho_invalido/);
  });

  it("não converte regra com ação que o schema recusa, dizendo qual", () => {
    const r = regraParaFluxo(regra({ actions: [{ type: "add_tag", config: { tags: [] } }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/^acao_invalida/);
    const r2 = regraParaFluxo(regra({ actions: [{ type: "acao_inventada", config: {} }] }));
    expect(r2.ok).toBe(false);
  });

  it("não converte regra que fecharia laço com o próprio gatilho (o publicar a recusaria)", () => {
    const r = regraParaFluxo(
      regra({
        trigger_event: "lead.assigned",
        conditions: [],
        actions: [{ type: "assign_owner", config: { user_id: USUARIO } }],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/acao_fecha_laco/);
  });
});

describe("os modelos de regra prontos do produto", () => {
  it("há modelos para provar (controle: um conjunto vazio passaria sem olhar nada)", () => {
    expect(MODELOS_DA_CENTRAL.length).toBeGreaterThan(5);
  });

  it.each(MODELOS_DA_CENTRAL.map((m) => [m.id, m] as const))(
    "%s converte em fluxo publicável",
    (_id, modelo) => {
      const r = regraParaFluxo(modelo.regra);
      expect(r, r.ok ? "" : r.motivo).toMatchObject({ ok: true });
    },
  );
});
