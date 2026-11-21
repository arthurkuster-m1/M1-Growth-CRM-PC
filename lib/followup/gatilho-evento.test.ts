import { describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";
import { ACTION_LABELS, TRIGGER_LABELS } from "@/app/app/webhooks/_components/labels";
import { TRIGGER_EVENTS } from "@/lib/schemas/webhooks";
import { triggerConfigSchema } from "./api-schemas";
import {
  aplicaGatilhoDeEvento,
  sujeitoDoEvento,
  type GatilhoEventoDb,
  type PointerDeEvento,
} from "./gatilho-evento";
import { ACOES_DO_CRM, EVENTOS_DO_CRM } from "./vocabulario";

const ORG = "11111111-1111-4111-8111-111111111111";
const LEAD = "44444444-4444-4444-8444-444444444444";
const CONTATO = "22222222-2222-4222-8222-222222222222";
const COMPROMISSO = "55555555-5555-4555-8555-555555555555";

function evento(extra: Partial<EventRow> = {}): EventRow {
  return {
    id: "ev-1",
    organization_id: ORG,
    event_type: "lead.tag_added",
    entity_kind: "crm_lead",
    entity_id: LEAD,
    payload: {},
    metadata: {},
    consumed_by: [],
    attempts: 0,
    ...extra,
  };
}

const POINTER: PointerDeEvento = {
  id: "p1",
  organization_id: ORG,
  active_version_id: "v1",
  conditions: [],
};

function cenario(
  opcoes: {
    pointers?: PointerDeEvento[];
    contexto?: Record<string, unknown>;
    jaVivo?: boolean;
  } = {},
) {
  const inseridos: Array<Record<string, unknown>> = [];
  const eventos: Array<Record<string, unknown>> = [];
  const db: GatilhoEventoDb = {
    carregaPointersDeEvento: vi.fn(async () => opcoes.pointers ?? [POINTER]),
    carregaContexto: vi.fn(async () => opcoes.contexto ?? { lead: { tags: ["Google"] } }),
    carregaNoDeGatilho: vi.fn(async () => ({ id: "n1" })),
    insereEnrollment: vi.fn(async (input) => {
      if (opcoes.jaVivo) return { inserted: false, id: null };
      inseridos.push(input);
      return { inserted: true, id: "enr-1" };
    }),
    insereEventoDoEnrollment: vi.fn(async (e) => {
      eventos.push(e);
    }),
  };
  return { db, inseridos, eventos };
}

describe("aplicaGatilhoDeEvento", () => {
  it("inscreve o fluxo no lead do evento, SEM contato nem conversa", async () => {
    const c = cenario();
    const r = await aplicaGatilhoDeEvento({ db: c.db }, evento());

    expect(r).toMatchObject({ matched: true, enrolled: 1, pointers_armados: 1 });
    expect(c.inseridos[0]).toEqual({
      organization_id: ORG,
      pointer_id: "p1",
      version_id: "v1",
      current_node_id: "n1",
      subject: { kind: "lead", id: LEAD },
      source_event_id: "ev-1",
    });
    expect(c.eventos[0]).toMatchObject({
      event_type: "enrolled_by_event",
      idempotency_key: "gatilho-evento:ev-1",
    });
  });

  it("os eventos do trigger do banco chegam como entity_kind 'lead' e valem como crm_lead", async () => {
    const c = cenario();
    const r = await aplicaGatilhoDeEvento(
      { db: c.db },
      evento({ event_type: "lead.won", entity_kind: "lead" }),
    );
    expect(r.enrolled).toBe(1);
    expect(c.inseridos[0]?.subject).toEqual({ kind: "lead", id: LEAD });
  });

  it("compromisso e contato viram o sujeito certo; mensagem usa o contato do payload", () => {
    expect(
      sujeitoDoEvento(
        evento({
          event_type: "appointment.created",
          entity_kind: "calendar_appointment",
          entity_id: COMPROMISSO,
        }),
      ),
    ).toEqual({ kind: "appointment", id: COMPROMISSO });
    expect(
      sujeitoDoEvento(
        evento({ event_type: "contact.birthday", entity_kind: "contact", entity_id: CONTATO }),
      ),
    ).toEqual({ kind: "contact", id: CONTATO });
    expect(
      sujeitoDoEvento(
        evento({
          event_type: "message.received",
          entity_kind: "message",
          entity_id: "m1",
          payload: { contact_id: CONTATO },
        }),
      ),
    ).toEqual({ kind: "contact", id: CONTATO });
    expect(
      sujeitoDoEvento(
        evento({ event_type: "message.received", entity_kind: "message", entity_id: "m1" }),
      ),
    ).toBeNull();
  });

  it("anti-laço: o que uma regra ou um fluxo gravou não reaciona automação", async () => {
    for (const metadata of [
      { caused_by_rule: "r1" },
      { request_id: "rule:abc" },
      { request_id: "followup:enr-9" },
    ]) {
      const c = cenario();
      const r = await aplicaGatilhoDeEvento({ db: c.db }, evento({ metadata }));
      expect(r.enrolled).toBe(0);
      expect(r.motivo_de_pular).toBe("caused_by_rule");
      expect(c.db.carregaPointersDeEvento).not.toHaveBeenCalled();
    }
  });

  it("evento APONTADO (relógio) só vale para o fluxo de mesmo id; sem apontar, vale para todos", async () => {
    const apontado = cenario();
    const r = await aplicaGatilhoDeEvento(
      { db: apontado.db },
      evento({ event_type: "lead.date_field_due", payload: { rule_id: "p1" } }),
    );
    expect(apontado.db.carregaPointersDeEvento).toHaveBeenCalledWith(
      ORG,
      "lead.date_field_due",
      "p1",
    );
    expect(r.enrolled).toBe(1);

    const solto = cenario();
    await aplicaGatilhoDeEvento({ db: solto.db }, evento());
    expect(solto.db.carregaPointersDeEvento).toHaveBeenCalledWith(ORG, "lead.tag_added", undefined);
  });

  it("evento apontado para uma REGRA antiga não inscreve fluxo nenhum (o banco filtra pelo id)", async () => {
    const c = cenario({ pointers: [] });
    const r = await aplicaGatilhoDeEvento(
      { db: c.db },
      evento({ event_type: "lead.silent_for", payload: { rule_id: "regra-antiga" } }),
    );
    expect(r).toMatchObject({ enrolled: 0, pointers_armados: 0 });
    expect(c.inseridos).toEqual([]);
  });

  it("entidade errada para o gatilho não roda (o fato duplicado do trigger legado)", async () => {
    const c = cenario();
    const r = await aplicaGatilhoDeEvento(
      { db: c.db },
      evento({ event_type: "lead.stage_changed", entity_kind: "lead" }),
    );
    expect(r.motivo_de_pular).toBe("entity_kind_mismatch");
    expect(c.inseridos).toEqual([]);
  });

  it("evento que não é gatilho de automação é ignorado", async () => {
    const c = cenario();
    const r = await aplicaGatilhoDeEvento({ db: c.db }, evento({ event_type: "agent.something" }));
    expect(r.motivo_de_pular).toBe("evento_sem_gatilho");
  });

  it("sem fluxo armado para o evento, nem carrega o contexto", async () => {
    const c = cenario({ pointers: [] });
    const r = await aplicaGatilhoDeEvento({ db: c.db }, evento());
    expect(r).toMatchObject({ matched: true, enrolled: 0, pointers_armados: 0 });
    expect(c.db.carregaContexto).not.toHaveBeenCalled();
  });

  it("condição que não bate não inscreve; a que bate inscreve", async () => {
    const c = cenario({
      pointers: [
        {
          ...POINTER,
          id: "nao",
          conditions: [{ field: "lead.tags", op: "contains", value: "Meta" }],
        },
        {
          ...POINTER,
          id: "sim",
          conditions: [{ field: "lead.tags", op: "contains", value: "Google" }],
        },
      ],
    });
    const r = await aplicaGatilhoDeEvento({ db: c.db }, evento());
    expect(r).toMatchObject({ enrolled: 1, skipped_condicao: 1 });
    expect(c.inseridos.map((i) => i.pointer_id)).toEqual(["sim"]);
  });

  it("contato pessoal não dispara automação nenhuma", async () => {
    const c = cenario({ contexto: { contact: { is_personal: true } } });
    const r = await aplicaGatilhoDeEvento({ db: c.db }, evento());
    expect(r.enrolled).toBe(0);
    expect(r.motivo_de_pular).toBe("contato_pessoal");
  });

  it("já tem fluxo vivo para o sujeito: conta, não duplica e não grava evento", async () => {
    const c = cenario({ jaVivo: true });
    const r = await aplicaGatilhoDeEvento({ db: c.db }, evento());
    expect(r).toMatchObject({ enrolled: 0, skipped_existing: 1 });
    expect(c.eventos).toEqual([]);
  });
});

describe("gatilho 'event' no schema do fluxo", () => {
  it("aceita o evento do seletor e preenche as condições vazias", () => {
    const r = triggerConfigSchema.parse({ kind: "event", params: { event_type: "lead.won" } });
    expect(r).toMatchObject({ kind: "event", params: { event_type: "lead.won", conditions: [] } });
  });

  it("recusa evento que o seletor não oferece e parâmetro sobrando", () => {
    expect(
      triggerConfigSchema.safeParse({ kind: "event", params: { event_type: "lead.inventado" } })
        .success,
    ).toBe(false);
    expect(
      triggerConfigSchema.safeParse({ kind: "event", params: { event_type: "lead.won", x: 1 } })
        .success,
    ).toBe(false);
    expect(triggerConfigSchema.safeParse({ kind: "event" }).success).toBe(false);
  });
});

describe("EVENTOS_DO_CRM", () => {
  it("diz a mesma frase da tela das regras para cada evento — as duas listas não divergem", () => {
    expect(Object.keys(EVENTOS_DO_CRM).sort()).toEqual([...TRIGGER_EVENTS].sort());
    expect(EVENTOS_DO_CRM).toEqual(TRIGGER_LABELS);
  });
});

describe("ACOES_DO_CRM", () => {
  it("diz a mesma frase da tela das regras para cada ação (e a IA decide a mais) — as listas não divergem", () => {
    expect(ACOES_DO_CRM).toEqual({ ...ACTION_LABELS, ai_decide: "A IA decide" });
  });
});
