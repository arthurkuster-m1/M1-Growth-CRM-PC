// @vitest-environment node
import { describe, expect, it } from "vitest";

import { aplicarFluxoAntiNoShow, fluxoSchema } from "./anti-no-show";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TIPO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONTATO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LEAD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const FLUXO: {
  id: string;
  call_hours_before: number | null;
  confirm_tag: string;
  no_show_tag: string;
  remarcar_days: number | null;
} = {
  id: "f1",
  call_hours_before: 3,
  confirm_tag: "Confirmou",
  no_show_tag: "No Show",
  remarcar_days: 1,
};

function fake(opts: { fluxo: typeof FLUXO | null; tags?: string[]; lead?: string | null }) {
  const updates: Array<{ tabela: string; patch: Record<string, unknown> }> = [];
  const from = (tabela: string) => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.order = () => c;
    c.limit = () => c;
    c.update = (patch: Record<string, unknown>) => {
      updates.push({ tabela, patch });
      return c;
    };
    c.maybeSingle = async () => {
      if (tabela === "agenda_noshow_flow_types") {
        return { data: opts.fluxo ? { flow_id: "f1" } : null };
      }
      if (tabela === "agenda_noshow_flows") return { data: opts.fluxo };
      if (tabela === "contacts") return { data: { tags: opts.tags ?? [] } };
      if (tabela === "crm_lead_links") return { data: opts.lead ? { lead_id: opts.lead } : null };
      return { data: null };
    };
    c.then = (ok: (v: unknown) => void) => ok({ data: null, error: null });
    return c;
  };
  return { admin: { from } as never, updates };
}

const base = {
  organizationId: ORG,
  appointmentId: "a1",
  eventTypeId: TIPO,
  contactId: CONTATO,
  hoje: "2026-10-26",
};

describe("aplicarFluxoAntiNoShow", () => {
  it("tipo sem fluxo: nada acontece", async () => {
    const f = fake({ fluxo: null });
    expect(await aplicarFluxoAntiNoShow(f.admin, { ...base, evento: "faltou" })).toBe("sem_fluxo");
    expect(f.updates).toHaveLength(0);
  });

  it("confirmou: põe a tag uma vez e não repete", async () => {
    const f = fake({ fluxo: FLUXO, tags: ["quente"] });
    await aplicarFluxoAntiNoShow(f.admin, { ...base, evento: "confirmou" });
    expect(f.updates[0]).toEqual({ tabela: "contacts", patch: { tags: ["quente", "Confirmou"] } });

    const g = fake({ fluxo: FLUXO, tags: ["confirmou"] });
    await aplicarFluxoAntiNoShow(g.admin, { ...base, evento: "confirmou" });
    expect(g.updates).toHaveLength(0);
  });

  it("faltou: tag com contador e a oportunidade volta à fila para remarcar", async () => {
    const f = fake({ fluxo: FLUXO, tags: ["No Show"], lead: LEAD });
    await aplicarFluxoAntiNoShow(f.admin, { ...base, evento: "faltou" });
    expect(f.updates[0]).toEqual({ tabela: "contacts", patch: { tags: ["No Show: 2x"] } });
    expect(f.updates[1]).toEqual({
      tabela: "crm_leads",
      patch: { proxima_acao: "Remarcar a reunião (faltou)", proxima_acao_em: "2026-10-27" },
    });
  });

  it("faltou sem remarcação no fluxo: só a tag", async () => {
    const f = fake({ fluxo: { ...FLUXO, remarcar_days: null }, lead: LEAD });
    await aplicarFluxoAntiNoShow(f.admin, { ...base, evento: "faltou" });
    expect(f.updates.map((u) => u.tabela)).toEqual(["contacts"]);
  });
});

describe("fluxoSchema", () => {
  it("recusa horas fora de 1–72 e dias fora de 0–30", () => {
    const ok = {
      name: "x",
      call_hours_before: 3,
      confirm_tag: "",
      no_show_tag: "",
      remarcar_days: 1,
      event_type_ids: [],
    };
    expect(fluxoSchema.safeParse(ok).success).toBe(true);
    expect(fluxoSchema.safeParse({ ...ok, call_hours_before: 0 }).success).toBe(false);
    expect(fluxoSchema.safeParse({ ...ok, remarcar_days: 31 }).success).toBe(false);
    expect(
      fluxoSchema.safeParse({ ...ok, call_hours_before: null, remarcar_days: null }).success,
    ).toBe(true);
  });
});
