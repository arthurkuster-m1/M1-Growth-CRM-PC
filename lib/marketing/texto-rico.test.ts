import { describe, expect, it } from "vitest";

import { alternarMarca, semMarcas, trechosDoTexto } from "@/lib/marketing/texto-rico";

describe("texto com estilo", () => {
  it("lê negrito, itálico e os dois", () => {
    expect(trechosDoTexto("a **b** *c* ***d***")).toEqual([
      { texto: "a ", negrito: false, italico: false },
      { texto: "b", negrito: true, italico: false },
      { texto: " ", negrito: false, italico: false },
      { texto: "c", negrito: false, italico: true },
      { texto: " ", negrito: false, italico: false },
      { texto: "d", negrito: true, italico: true },
    ]);
  });

  it("marca sem par e asterisco solto ficam como texto", () => {
    expect(semMarcas("5 * 3 e **aberto")).toBe("5 * 3 e **aberto");
  });

  it("Ctrl+B liga e desliga na seleção", () => {
    const ligado = alternarMarca("um dois tres", 3, 7, "**");
    expect(ligado.valor).toBe("um **dois** tres");
    expect(alternarMarca(ligado.valor, ligado.ini, ligado.fim, "**").valor).toBe("um dois tres");
  });

  it("sem seleção abre um par de marcas com o cursor no meio", () => {
    expect(alternarMarca("ab", 1, 1, "*")).toEqual({ valor: "a**b", ini: 2, fim: 2 });
  });
});
