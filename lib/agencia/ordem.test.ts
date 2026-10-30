import { describe, expect, it } from "vitest";

import { aplicarOrdem } from "./acesso";

const c = (id: string) => ({ id });

describe("ordem dos clientes", () => {
  it("segue a ordem escolhida e deixa os não ordenados depois, na ordem em que vieram", () => {
    const r = aplicarOrdem([c("a"), c("b"), c("c"), c("d")], ["c", "a"]);
    expect(r.map((x) => x.id)).toEqual(["c", "a", "b", "d"]);
  });
  it("ignora ids que não existem mais", () => {
    expect(aplicarOrdem([c("a"), c("b")], ["x", "b"]).map((x) => x.id)).toEqual(["b", "a"]);
  });
});
