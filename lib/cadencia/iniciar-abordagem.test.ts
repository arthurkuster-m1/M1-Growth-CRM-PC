// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { moverLeadParaEtapa } from "@/lib/leads/appointment-stage-move";

import { iniciarAbordagemDoDisparo, iniciarAbordagemDosLeads } from "./iniciar-abordagem";

vi.mock("@/lib/leads/appointment-stage-move", () => ({ moverLeadParaEtapa: vi.fn() }));

const lead = (id: string, pipeline = "p1") => ({
  id,
  pipeline_id: pipeline,
  stage_id: "e0",
  contact_id: `c-${id}`,
  status: "open",
  custom_fields: null,
  won_reason: null,
  stage: { slug: "novo-lead", name: "Novo lead" },
});

function fake(opts: {
  leads?: unknown[];
  abordagem?: unknown;
  destinatarios?: string[];
  leadsDosContatos?: string[];
}) {
  const from = (tabela: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in"]) c[m] = () => c;
    c.limit = async () =>
      tabela === "campaign_recipients"
        ? { data: (opts.destinatarios ?? []).map((contact_id) => ({ contact_id })) }
        : { data: [] };
    c.maybeSingle = async () => ({ data: opts.abordagem ?? null });
    c.then = (ok: (v: unknown) => void) =>
      ok({
        data:
          tabela === "crm_leads" && opts.leadsDosContatos
            ? opts.leadsDosContatos.map((id) => ({ id }))
            : (opts.leads ?? []),
      });
    return c;
  };
  return { from } as never;
}

describe("iniciarAbordagemDosLeads", () => {
  beforeEach(() => {
    vi.mocked(moverLeadParaEtapa).mockReset();
    vi.mocked(moverLeadParaEtapa).mockResolvedValue({ moveu: true, motivo: "movido" });
  });

  it("move quem estava em Novo lead para Abordagem do mesmo funil", async () => {
    const r = await iniciarAbordagemDosLeads(
      fake({ leads: [lead("l1"), lead("l2")], abordagem: { id: "ab", name: "Abordagem" } }),
      { organizationId: "o1", leadIds: ["l1", "l2"], motivo: "teste" },
    );
    expect(r).toEqual({ movidos: 2, recusados: 0 });
    const chamada = vi.mocked(moverLeadParaEtapa).mock.calls[0]![1];
    expect(chamada.etapaRow.id).toBe("ab");
    expect(chamada.origem).toEqual({ name: "Novo lead" });
    expect(chamada.motivoDoMovimento).toBe("teste");
  });

  it("funil sem etapa Abordagem: não mexe; recusa da régua conta como recusado", async () => {
    expect(
      await iniciarAbordagemDosLeads(fake({ leads: [lead("l1")], abordagem: null }), {
        organizationId: "o1",
        leadIds: ["l1"],
        motivo: "t",
      }),
    ).toEqual({ movidos: 0, recusados: 0 });
    expect(moverLeadParaEtapa).not.toHaveBeenCalled();

    vi.mocked(moverLeadParaEtapa).mockResolvedValue({
      moveu: false,
      motivo: "campos_obrigatorios",
    });
    expect(
      await iniciarAbordagemDosLeads(
        fake({ leads: [lead("l1")], abordagem: { id: "ab", name: "Abordagem" } }),
        { organizationId: "o1", leadIds: ["l1"], motivo: "t" },
      ),
    ).toEqual({ movidos: 0, recusados: 1 });
  });

  it("lista vazia: nada acontece", async () => {
    expect(
      await iniciarAbordagemDosLeads(fake({}), { organizationId: "o1", leadIds: [], motivo: "t" }),
    ).toEqual({ movidos: 0, recusados: 0 });
  });
});

describe("iniciarAbordagemDoDisparo", () => {
  it("disparo sem campanha de prospecção não mexe em funil", async () => {
    vi.mocked(moverLeadParaEtapa).mockClear();
    expect(
      await iniciarAbordagemDoDisparo(fake({}), {
        organizationId: "o1",
        disparoId: "d1",
        demandCampaignId: null,
      }),
    ).toEqual({ movidos: 0, recusados: 0 });
    expect(moverLeadParaEtapa).not.toHaveBeenCalled();
  });
});
