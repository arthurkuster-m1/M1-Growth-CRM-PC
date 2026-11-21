import { describe, expect, it } from "vitest";

import { carregaRegrasDeRelogio } from "./regras-de-relogio";

const ORG = "11111111-1111-4111-8111-111111111111";

/** Dublê do supabase-js: cada tabela devolve as suas linhas (ou um erro). */
function admin(tabelas: {
  automation_rules?: unknown[];
  followup_flow_pointers?: unknown[];
  erro?: string;
}) {
  const from = (tabela: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      in: () => q,
      eq: () => q,
      not: () => q,
      then: (ok: (v: unknown) => unknown) =>
        Promise.resolve(
          tabelas.erro === tabela
            ? { data: null, error: { message: "falhou" } }
            : { data: (tabelas as Record<string, unknown[]>)[tabela] ?? [], error: null },
        ).then(ok),
    };
    return q;
  };
  return { from } as never;
}

const fluxo = (id: string, params: Record<string, unknown>, kind = "event") => ({
  id,
  organization_id: ORG,
  trigger_config: { kind, params },
});

describe("carregaRegrasDeRelogio", () => {
  it("junta as regras ativas e os fluxos de automação do tipo pedido, na mesma forma", async () => {
    const r = await carregaRegrasDeRelogio(
      admin({
        automation_rules: [
          {
            id: "regra-1",
            organization_id: ORG,
            trigger_event: "lead.silent_for",
            trigger_config: { dias: 3 },
          },
        ],
        followup_flow_pointers: [
          fluxo("fluxo-1", { event_type: "lead.silent_for", config: { dias: 5 } }),
          fluxo("fluxo-2", { event_type: "lead.stage_stale" }),
        ],
      }),
      ["lead.silent_for", "lead.stage_stale"],
    );
    expect(r.error).toBeNull();
    expect(r.data).toEqual([
      {
        id: "regra-1",
        organization_id: ORG,
        trigger_event: "lead.silent_for",
        trigger_config: { dias: 3 },
      },
      {
        id: "fluxo-1",
        organization_id: ORG,
        trigger_event: "lead.silent_for",
        trigger_config: { dias: 5 },
      },
      {
        id: "fluxo-2",
        organization_id: ORG,
        trigger_event: "lead.stage_stale",
        trigger_config: {},
      },
    ]);
  });

  it("ignora fluxo de outro tipo de evento e fluxo com gatilho que não é 'event'", async () => {
    const r = await carregaRegrasDeRelogio(
      admin({
        followup_flow_pointers: [
          fluxo("a", { event_type: "lead.won" }),
          { id: "b", organization_id: ORG, trigger_config: { kind: "manual" } },
          {
            id: "c",
            organization_id: ORG,
            trigger_config: { kind: "event", params: { event_type: "lixo" } },
          },
        ],
      }),
      ["lead.silent_for"],
    );
    expect(r.data).toEqual([]);
  });

  it("erro numa das fontes vira erro (o cron não pode achar que não há regra)", async () => {
    for (const erro of ["automation_rules", "followup_flow_pointers"]) {
      const r = await carregaRegrasDeRelogio(admin({ erro }), ["lead.silent_for"]);
      expect(r.data).toBeNull();
      expect(r.error?.message).toBe("falhou");
    }
  });
});
