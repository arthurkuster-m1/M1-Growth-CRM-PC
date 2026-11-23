import { describe, expect, it } from "vitest";

import { grafoInicialDaAutomacao } from "./grafo-inicial-da-automacao";
import { validateFlowForPublish } from "./validate-publish";

describe("grafoInicialDaAutomacao", () => {
  it("nasce com gatilho → fim, e já é um grafo que o publicar aceita", () => {
    const g = grafoInicialDaAutomacao();
    expect(g.nodes.map((n) => n.type)).toEqual(["trigger", "end"]);
    expect(g.edges).toHaveLength(1);
    expect(validateFlowForPublish(g, { surface: "crm_automation" })).toEqual({ ok: true });
  });
});
