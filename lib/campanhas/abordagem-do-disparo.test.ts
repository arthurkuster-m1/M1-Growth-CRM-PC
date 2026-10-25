// @vitest-environment node
import { describe, expect, it } from "vitest";

import { recusaDaAbordagemDoDisparo } from "./abordagem-do-disparo";

function fake(linha: { id: string; medium: string } | null) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) c[m] = () => c;
  c.maybeSingle = async () => ({ data: linha });
  return { from: () => c } as never;
}
const base = { organizationId: "o1", abordagemId: "a1", demandCampaignId: "d1" };

describe("recusaDaAbordagemDoDisparo", () => {
  it("sem abordagem escolhida não há o que recusar", async () => {
    expect(await recusaDaAbordagemDoDisparo(fake(null), { ...base, abordagemId: null })).toBeNull();
  });
  it("disparo avulso não escolhe abordagem", async () => {
    expect(
      await recusaDaAbordagemDoDisparo(fake(null), { ...base, demandCampaignId: null }),
    ).toMatch(/campanha de prospecção/);
  });
  it("abordagem de outra campanha ou que não existe é recusada", async () => {
    expect(await recusaDaAbordagemDoDisparo(fake(null), base)).toMatch(/não é desta campanha/);
  });
  it("só WhatsApp", async () => {
    expect(await recusaDaAbordagemDoDisparo(fake({ id: "a1", medium: "ligacao" }), base)).toMatch(
      /WhatsApp/,
    );
    expect(
      await recusaDaAbordagemDoDisparo(fake({ id: "a1", medium: "whatsapp" }), base),
    ).toBeNull();
  });
});
