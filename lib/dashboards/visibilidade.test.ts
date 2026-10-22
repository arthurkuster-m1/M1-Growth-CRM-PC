import { describe, expect, it } from "vitest";

import { lerOcultos } from "./visibilidade";

describe("lerOcultos", () => {
  it("lê os ids conhecidos, na ordem das abas", () => {
    expect(lerOcultos({ dashboards: { ocultos: ["business", "trafego"] } })).toEqual([
      "trafego",
      "business",
    ]);
  });
  it("ignora o que não é painel e valor estranho", () => {
    expect(lerOcultos({ dashboards: { ocultos: ["x", "comercial"] } })).toEqual(["comercial"]);
    expect(lerOcultos({ dashboards: { ocultos: "trafego" } })).toEqual([]);
    expect(lerOcultos(null)).toEqual([]);
    expect(lerOcultos({})).toEqual([]);
  });
});
