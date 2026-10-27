import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { concluirCompromissosDaVenda } from "./concluir-compromissos-da-venda";

/** Um cliente de banco de mentira: cada tabela devolve a sua lista, e as RPCs ficam anotadas. */
function banco(tabelas: Record<string, unknown>) {
  const rpc = vi.fn(async () => ({ error: null }));
  const consulta = (dados: unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "lte"]) q[m] = () => q;
    q.maybeSingle = async () => ({ data: dados });
    q.then = (ok: (v: unknown) => unknown) => ok({ data: dados });
    return q;
  };
  return { rpc, from: (t: string) => consulta(tabelas[t]) } as never as Parameters<
    typeof concluirCompromissosDaVenda
  >[0] & { rpc: typeof rpc };
}

const LEAD = { status: "open", is_recurring: false, recurrence_active: false };

describe("a venda puxa o compromisso", () => {
  it("venda comprometida: o compromisso aberto e já começado vira realizado", async () => {
    const db = banco({
      crm_leads: { ...LEAD, payments: [{ status: "prevista" }] },
      crm_lead_links: [{ target_id: "a1" }],
      calendar_appointments: [{ id: "a1", revision: 3 }],
    });
    expect(await concluirCompromissosDaVenda(db, "org", "lead")).toBe(1);
    expect(db.rpc).toHaveBeenCalledWith("fn_appointment_change", {
      p_org: "org",
      p_id: "a1",
      p_revision: 3,
      p_patch: { status: "completed" },
    });
  });

  it("oportunidade ainda em interesse: não mexe em compromisso nenhum", async () => {
    const db = banco({
      crm_leads: { ...LEAD, payments: [] },
      crm_lead_links: [{ target_id: "a1" }],
      calendar_appointments: [{ id: "a1", revision: 1 }],
    });
    expect(await concluirCompromissosDaVenda(db, "org", "lead")).toBe(0);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("venda cancelada (não comprou): não conta como comparecimento", async () => {
    const db = banco({
      crm_leads: { ...LEAD, status: "lost", payments: [{ status: "cancelada" }] },
      crm_lead_links: [{ target_id: "a1" }],
      calendar_appointments: [{ id: "a1", revision: 1 }],
    });
    expect(await concluirCompromissosDaVenda(db, "org", "lead")).toBe(0);
  });
});
