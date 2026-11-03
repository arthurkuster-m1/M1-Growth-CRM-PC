import { describe, expect, it } from "vitest";

import { passosVisiveis, proximoPasso, resumoDoOnboarding } from "./passos";

describe("onboarding novo (curto)", () => {
  it("só Seu negócio e Sua equipe", () => {
    expect(passosVisiveis({}).map((p) => p.segmento)).toEqual(["welcome", "invite-team"]);
    expect(passosVisiveis({}).map((p) => p.rotulo)).toEqual(["Seu negócio", "Sua equipe"]);
  });
  it("sem nada feito, começa pelo negócio; depois a equipe; depois acaba", () => {
    expect(proximoPasso({}, {})?.segmento).toBe("welcome");
    expect(
      proximoPasso(
        {
          welcome: { accepted_at: "x", timezone: "America/Sao_Paulo", display_name: "A" },
        } as never,
        {},
      )?.segmento,
    ).toBe("invite-team");
    expect(
      proximoPasso(
        {
          welcome: { accepted_at: "x", timezone: "America/Sao_Paulo", display_name: "A" },
          team: { skipped: true },
        } as never,
        {},
      ),
    ).toBeNull();
  });
  it("o resumo distingue feito de pulado", () => {
    const r = resumoDoOnboarding(
      {
        welcome: { accepted_at: "x", timezone: "t", display_name: "A" },
        team: { skipped: true },
      } as never,
      {},
    );
    expect(r.find((i) => i.segmento === "welcome")).toMatchObject({ feito: true, pulado: false });
    expect(r.find((i) => i.segmento === "invite-team")).toMatchObject({
      feito: false,
      pulado: true,
    });
  });
});
