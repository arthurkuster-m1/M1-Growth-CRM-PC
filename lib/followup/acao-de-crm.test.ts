import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionCtx, ActionExecutor } from "@/lib/automation/types";

const registro = new Map<string, ActionExecutor>();
vi.mock("@/lib/automation/actions", () => ({ getAction: (t: string) => registro.get(t) }));
vi.mock("@/lib/automation/actions/register-all", () => ({}));
vi.mock("@/lib/automation/engine", () => ({
  buildContext: vi.fn(async () => ({ lead: { id: "lead-1" }, contact: { id: "c-1" } })),
}));

import {
  adiarAcaoDeCrm,
  ERRO_EVENTO_DE_ORIGEM_INDISPONIVEL,
  executarAcaoDeCrm,
  type ItemDeAcaoDeCrm,
} from "./acao-de-crm";

const ORG = "11111111-1111-4111-8111-111111111111";

function item(extra: Partial<ItemDeAcaoDeCrm> = {}): ItemDeAcaoDeCrm {
  return {
    organization_id: ORG,
    enrollment_id: "enr-1",
    pointer_id: "ptr-1",
    node_id: "n2",
    source_event_id: "ev-1",
    subject: { kind: "lead", id: "lead-1" },
    action: { type: "add_tag", config: { tags: ["vip"] } },
    indice: 1,
    acoes: [
      { type: "call_webhook", config: {} },
      { type: "add_tag", config: { tags: ["vip"] } },
    ],
    ...extra,
  };
}

/** Dublê do supabase-js: event_log devolve `evento` (ou nada), pointers devolvem o nome. */
function admin(evento: Record<string, unknown> | null) {
  const consultas: Array<{ tabela: string; filtros: Array<[string, unknown]> }> = [];
  const from = (tabela: string) => {
    const c = { tabela, filtros: [] as Array<[string, unknown]> };
    consultas.push(c);
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (col: string, val: unknown) => {
        c.filtros.push([col, val]);
        return q;
      },
      maybeSingle: async () => ({
        data: tabela === "event_log" ? evento : { name: "Boas-vindas" },
        error: null,
      }),
    };
    return q;
  };
  return { client: { from } as never, consultas };
}

const EVENTO = {
  id: "ev-1",
  organization_id: ORG,
  event_type: "lead.tag_added",
  entity_kind: "crm_lead",
  entity_id: "lead-1",
  payload: {},
  metadata: {},
  consumed_by: [],
  attempts: 0,
};

beforeEach(() => registro.clear());

describe("executarAcaoDeCrm", () => {
  it("entrega à ação o contexto das regras: evento de origem, lead/contato, ruleId e posição", async () => {
    let recebido: ActionCtx | undefined;
    registro.set("add_tag", {
      type: "add_tag",
      execute: async (ctx) => {
        recebido = ctx;
        return { type: "add_tag", status: "success" };
      },
    });
    const a = admin(EVENTO);

    const r = await executarAcaoDeCrm(a.client, item());

    expect(r).toEqual({ type: "add_tag", status: "success" });
    expect(recebido).toMatchObject({
      organizationId: ORG,
      ruleId: "followup:enr-1",
      ruleName: "Boas-vindas",
      requestId: "enr-1:n2",
      actionIndex: 1,
      event: { id: "ev-1" },
      context: { lead: { id: "lead-1" }, contact: { id: "c-1" } },
    });
    expect(recebido?.ruleActions).toHaveLength(2);
    expect(recebido?.serviceBoundaries).toBeInstanceOf(Map);
  });

  it("toda leitura do banco filtra a organização", async () => {
    registro.set("add_tag", {
      type: "add_tag",
      execute: async () => ({ type: "add_tag", status: "success" }),
    });
    const a = admin(EVENTO);
    await executarAcaoDeCrm(a.client, item());
    for (const c of a.consultas) expect(c.filtros).toContainEqual(["organization_id", ORG]);
    expect(a.consultas.map((c) => c.tabela)).toEqual(["event_log", "followup_flow_pointers"]);
  });

  it("ação desconhecida falha sem tocar no banco", async () => {
    const a = admin(EVENTO);
    expect(
      await executarAcaoDeCrm(a.client, item({ action: { type: "nada", config: {} } })),
    ).toEqual({
      type: "nada",
      status: "failed",
      error: "unknown_action",
    });
    expect(a.consultas).toEqual([]);
  });

  it("sem o evento de origem falha com o motivo (nunca executa no escuro)", async () => {
    const executa = vi.fn(async () => ({ type: "add_tag", status: "success" as const }));
    registro.set("add_tag", { type: "add_tag", execute: executa });

    // a inscrição não guarda o id do evento
    const semId = await executarAcaoDeCrm(admin(EVENTO).client, item({ source_event_id: null }));
    // tem o id, mas a linha do event_log não existe mais (retenção)
    const semLinha = await executarAcaoDeCrm(admin(null).client, item());

    for (const r of [semId, semLinha]) {
      expect(r).toMatchObject({ status: "failed", error: ERRO_EVENTO_DE_ORIGEM_INDISPONIVEL });
    }
    expect(executa).not.toHaveBeenCalled();
  });

  it("ação que reabriria o próprio gatilho é pulada, não executada", async () => {
    const executa = vi.fn(async () => ({ type: "assign_owner", status: "success" as const }));
    registro.set("assign_owner", { type: "assign_owner", execute: executa });
    const a = admin({ ...EVENTO, event_type: "lead.assigned" });

    const r = await executarAcaoDeCrm(
      a.client,
      item({ action: { type: "assign_owner", config: { user_id: "u" } } }),
    );

    expect(r).toEqual({ type: "assign_owner", status: "skipped", error: "acao_fecharia_laco" });
    expect(executa).not.toHaveBeenCalled();
  });
});

describe("adiarAcaoDeCrm", () => {
  it("devolve a hora que a ação pede (janela de envio)", async () => {
    registro.set("send_whatsapp_message", {
      type: "send_whatsapp_message",
      postponeUntil: async () => "2026-11-22T10:00:00.000Z",
      execute: async () => ({ type: "send_whatsapp_message", status: "success" }),
    });
    const a = admin(EVENTO);
    expect(
      await adiarAcaoDeCrm(
        a.client,
        item({ action: { type: "send_whatsapp_message", config: {} } }),
      ),
    ).toBe("2026-11-22T10:00:00.000Z");
  });

  it("ação sem pré-checagem nunca adia, e nem lê o banco", async () => {
    registro.set("add_tag", {
      type: "add_tag",
      execute: async () => ({ type: "add_tag", status: "success" }),
    });
    const a = admin(EVENTO);
    expect(await adiarAcaoDeCrm(a.client, item())).toBeNull();
    expect(a.consultas).toEqual([]);
  });
});
