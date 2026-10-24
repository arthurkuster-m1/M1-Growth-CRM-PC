// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { moverLeadParaEtapa } from "@/lib/leads/appointment-stage-move";

import { subirDeEtapaAoResponder } from "./subir-de-etapa";

vi.mock("@/lib/leads/appointment-stage-move", () => ({ moverLeadParaEtapa: vi.fn() }));

const ETAPAS = [
  { id: "e1", name: "Abordagem", slug: "abordagem", position: 1000, is_won: false, is_lost: false },
  { id: "e2", name: "Contato", slug: "contato", position: 2000, is_won: false, is_lost: false },
  {
    id: "e3",
    name: "Contato com decisor",
    slug: "contato-com-decisor",
    position: 3000,
    is_won: false,
    is_lost: false,
  },
];

function fake(stageId: string, etapas = ETAPAS, status = "open") {
  const from = (tabela: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq"]) c[m] = () => c;
    c.limit = async () => ({ data: tabela === "crm_stages" ? etapas : [] });
    c.maybeSingle = async () => ({
      data: {
        id: "l1",
        pipeline_id: "p1",
        stage_id: stageId,
        contact_id: "c1",
        status,
        custom_fields: null,
        won_reason: null,
      },
    });
    return c;
  };
  return { from } as never;
}

const entrada = { organizationId: "o1", leadId: "l1" };

describe("subirDeEtapaAoResponder", () => {
  beforeEach(() => {
    vi.mocked(moverLeadParaEtapa).mockReset();
    vi.mocked(moverLeadParaEtapa).mockResolvedValue({ moveu: true, motivo: "movido" });
  });

  it("falou com o decisor: vai para 'Contato com decisor'", async () => {
    expect(await subirDeEtapaAoResponder(fake("e1"), { ...entrada, decisor: true })).toBe("movido");
    expect(vi.mocked(moverLeadParaEtapa).mock.calls[0]![1].etapaRow.id).toBe("e3");
  });

  it("só atendeu: vai para 'Contato'", async () => {
    await subirDeEtapaAoResponder(fake("e1"), { ...entrada, decisor: false });
    expect(vi.mocked(moverLeadParaEtapa).mock.calls[0]![1].etapaRow.id).toBe("e2");
  });

  it("nunca volta: quem já está adiante fica onde está", async () => {
    expect(await subirDeEtapaAoResponder(fake("e3"), { ...entrada, decisor: false })).toBe(
      "ja_adiante",
    );
    expect(moverLeadParaEtapa).not.toHaveBeenCalled();
  });

  it("funil sem a etapa de decisor: cai em 'Contato'; sem nenhuma das duas, não mexe", async () => {
    await subirDeEtapaAoResponder(fake("e1", ETAPAS.slice(0, 2)), { ...entrada, decisor: true });
    expect(vi.mocked(moverLeadParaEtapa).mock.calls[0]![1].etapaRow.id).toBe("e2");

    vi.mocked(moverLeadParaEtapa).mockClear();
    expect(
      await subirDeEtapaAoResponder(fake("e1", ETAPAS.slice(0, 1)), { ...entrada, decisor: true }),
    ).toBe("sem_etapa");
    expect(moverLeadParaEtapa).not.toHaveBeenCalled();
  });

  it("negócio fechado não se move", async () => {
    expect(
      await subirDeEtapaAoResponder(fake("e1", ETAPAS, "won"), { ...entrada, decisor: true }),
    ).toBe("nao_moveu");
  });
});
