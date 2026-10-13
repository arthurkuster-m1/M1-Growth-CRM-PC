import { describe, expect, it } from "vitest";

import { proximaOrdenacao } from "./ordenar-por-coluna";

describe("proximaOrdenacao", () => {
  it("1º clique: crescente; 2º: decrescente; 3º: sem ordenação", () => {
    const a = proximaOrdenacao(undefined, "nome");
    expect(a).toEqual([{ campo: "nome", direcao: "asc" }]);
    const b = proximaOrdenacao(a, "nome");
    expect(b).toEqual([{ campo: "nome", direcao: "desc" }]);
    expect(proximaOrdenacao(b, "nome")).toBeUndefined();
  });
  it("coluna nova troca a ordenação inteira", () => {
    expect(proximaOrdenacao([{ campo: "nome", direcao: "desc" }], "valor")).toEqual([
      { campo: "valor", direcao: "asc" },
    ]);
  });
  it("ordem composta: clicar recomeça pela coluna clicada", () => {
    expect(
      proximaOrdenacao(
        [
          { campo: "nome", direcao: "asc" },
          { campo: "valor", direcao: "desc" },
        ],
        "nome",
      ),
    ).toEqual([{ campo: "nome", direcao: "asc" }]);
  });
});
