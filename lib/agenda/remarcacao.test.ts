// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  TEXTO_DE_REMARCACAO_ESGOTADA,
  encerrarRemarcacoesDoContato,
  registrarTentativaNaRemarcacao,
} from "./remarcacao";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEAD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function fake(remarcacao: Record<string, unknown> | null, leads: string[] = []) {
  const updates: Array<{ tabela: string; patch: Record<string, unknown> }> = [];
  const from = (tabela: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in"]) c[m] = () => c;
    c.limit = async () => ({ data: leads.map((id) => ({ id })) });
    c.update = (patch: Record<string, unknown>) => {
      updates.push({ tabela, patch });
      return c;
    };
    c.maybeSingle = async () => ({ data: remarcacao });
    c.then = (ok: (v: unknown) => void) => ok({ data: null, error: null });
    return c;
  };
  return { admin: { from } as never, updates };
}

const andamento = (attempts_done: number, max_attempts = 3) => ({
  id: "r1",
  attempts_done,
  max_attempts,
  interval_days: 2,
});

describe("registrarTentativaNaRemarcacao", () => {
  it("lead sem remarcação ativa: nada acontece", async () => {
    const f = fake(null);
    expect(
      await registrarTentativaNaRemarcacao(f.admin, {
        organizationId: ORG,
        leadId: LEAD,
        respondeu: false,
      }),
    ).toBe("sem_remarcacao");
    expect(f.updates).toHaveLength(0);
  });

  it("respondeu: a remarcação termina", async () => {
    const f = fake(andamento(1));
    expect(
      await registrarTentativaNaRemarcacao(f.admin, {
        organizationId: ORG,
        leadId: LEAD,
        respondeu: true,
      }),
    ).toBe("respondeu");
    expect(f.updates).toEqual([
      { tabela: "agenda_noshow_remarcacoes", patch: { status: "respondeu" } },
    ]);
  });

  it("sem resposta: conta a tentativa e agenda a seguinte daqui a N dias úteis", async () => {
    const f = fake(andamento(0));
    expect(
      await registrarTentativaNaRemarcacao(f.admin, {
        organizationId: ORG,
        leadId: LEAD,
        respondeu: false,
        hoje: "2026-10-26",
      }),
    ).toBe("proxima");
    expect(f.updates[0]!.patch).toEqual({ attempts_done: 1 });
    expect(f.updates[1]).toEqual({
      tabela: "crm_leads",
      patch: {
        proxima_acao: "Remarcar a reunião (faltou) — tentativa 2 de 3",
        proxima_acao_em: "2026-10-28",
      },
    });
  });

  it("na última tentativa sem resposta: esgota e pede uma decisão", async () => {
    const f = fake(andamento(2));
    expect(
      await registrarTentativaNaRemarcacao(f.admin, {
        organizationId: ORG,
        leadId: LEAD,
        respondeu: false,
        hoje: "2026-10-26",
      }),
    ).toBe("esgotada");
    expect(f.updates[0]!.patch).toEqual({ status: "esgotada", attempts_done: 3 });
    expect(f.updates[1]!.patch).toEqual({
      proxima_acao: TEXTO_DE_REMARCACAO_ESGOTADA,
      proxima_acao_em: "2026-10-26",
    });
  });
});

describe("encerrarRemarcacoesDoContato", () => {
  it("o contato marcou de novo: as remarcações ativas dos leads dele viram 'remarcou'", async () => {
    const f = fake(null, [LEAD]);
    await encerrarRemarcacoesDoContato(f.admin, { organizationId: ORG, contactId: "c1" });
    expect(f.updates).toEqual([
      { tabela: "agenda_noshow_remarcacoes", patch: { status: "remarcou" } },
    ]);
  });

  it("contato sem lead: não faz nada", async () => {
    const f = fake(null, []);
    await encerrarRemarcacoesDoContato(f.admin, { organizationId: ORG, contactId: "c1" });
    expect(f.updates).toHaveLength(0);
  });
});
