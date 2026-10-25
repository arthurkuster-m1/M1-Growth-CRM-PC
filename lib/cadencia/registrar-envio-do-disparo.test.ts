// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("./progresso", () => ({ registrarTentativaNaCadencia: vi.fn(async () => "avancou") }));

import { registrarTentativaNaCadencia } from "./progresso";
import { registrarEnvioDoDisparo } from "./registrar-envio-do-disparo";

function fake(lead: { id: string } | null, tags: string[] = []) {
  const escritas: Array<{ tabela: string; dado: Record<string, unknown> }> = [];
  const from = (tabela: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c;
    c.insert = (dado: Record<string, unknown>) => {
      escritas.push({ tabela, dado });
      return Promise.resolve({ error: null });
    };
    c.update = (dado: Record<string, unknown>) => {
      escritas.push({ tabela, dado });
      return c;
    };
    c.maybeSingle = async () => ({
      data:
        tabela === "crm_leads"
          ? lead
          : tabela === "demand_campaign_approaches"
            ? { name: "Cold WhatsApp" }
            : { tags },
    });
    c.then = (ok: (v: unknown) => void) => ok({ data: null, error: null });
    return c;
  };
  return { admin: { from } as never, escritas };
}

const base = {
  organizationId: "o1",
  contactId: "c1",
  disparoId: "d1",
  disparoNome: "Primeira onda",
  demandCampaignId: "dc1",
  approachId: "a1",
};

describe("registrarEnvioDoDisparo", () => {
  it("linha do tempo SEM nota de abordagem, passo da cadência e tag com contador", async () => {
    vi.mocked(registrarTentativaNaCadencia).mockClear();
    const f = fake({ id: "l1" }, ["Abordagem: Cold WhatsApp"]);
    expect(await registrarEnvioDoDisparo(f.admin, base)).toBe("registrado");
    const atividade = f.escritas.find((e) => e.tabela === "crm_lead_activities")!.dado;
    expect(atividade).toMatchObject({ lead_id: "l1" });
    expect(JSON.stringify(atividade)).toContain("disparo_enviado");
    expect(JSON.stringify(atividade)).not.toContain('"acao":"mensagem"');
    expect(registrarTentativaNaCadencia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ leadId: "l1", respondeu: false }),
    );
    expect(f.escritas.find((e) => e.tabela === "contacts")!.dado).toEqual({
      tags: ["Abordagem: Cold WhatsApp: 2x"],
    });
  });

  it("disparo avulso ou contato sem lead na campanha: nada acontece", async () => {
    const a = fake({ id: "l1" });
    expect(await registrarEnvioDoDisparo(a.admin, { ...base, demandCampaignId: null })).toBe(
      "sem_lead",
    );
    expect(a.escritas).toHaveLength(0);
    const b = fake(null);
    expect(await registrarEnvioDoDisparo(b.admin, base)).toBe("sem_lead");
    expect(b.escritas).toHaveLength(0);
  });
});
