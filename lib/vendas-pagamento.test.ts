import { describe, expect, it } from "vitest";

import { faltaParaPagar, mensagemDaFalta } from "./vendas-pagamento";

describe("o que a venda precisa para ser paga", () => {
  it("sem produto, sem responsável e sem forma: falta tudo", () => {
    const falta = faltaParaPagar({ itens: 0, responsavelId: null, forma: "" });
    expect(falta).toEqual(["produto", "responsavel", "forma_de_pagamento"]);
    expect(mensagemDaFalta(falta)).toBe(
      "Para marcar como pago, informe pelo menos um produto, o responsável pela venda, a forma de pagamento.",
    );
  });
  it("completa: nada falta", () => {
    expect(faltaParaPagar({ itens: 1, responsavelId: "u1", forma: "pix" })).toEqual([]);
  });
  it("forma só com espaços não conta", () => {
    expect(faltaParaPagar({ itens: 2, responsavelId: "u1", forma: "  " })).toEqual([
      "forma_de_pagamento",
    ]);
  });
});
