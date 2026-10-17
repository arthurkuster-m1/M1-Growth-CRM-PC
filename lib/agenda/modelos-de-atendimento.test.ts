import { describe, expect, it } from "vitest";

import { lerModeloDoTipo, padraoDoModelo } from "./modelos-de-atendimento";

describe("lerModeloDoTipo", () => {
  it("sem nada gravado, reunião vira modelo de vendas com o roteiro padrão", () => {
    const m = lerModeloDoTipo(undefined, { nome: "Reunião", slug: "reuniao" });
    expect(m.modelo).toBe("vendas");
    expect(m.roteiro.length).toBeGreaterThan(3);
    expect(m.blocos.roteiro).toBe(true);
  });
  it("sem nada gravado, atendimento simples não traz roteiro", () => {
    const m = lerModeloDoTipo(null, { nome: "Atendimento", slug: "atendimento" });
    expect(m).toEqual(padraoDoModelo("padrao"));
  });
  it("o que a empresa gravou vale, e passo sem título some", () => {
    const m = lerModeloDoTipo(
      { modelo: "vendas", blocos: { ia: false }, roteiro: [{ titulo: " Abertura ", dica: "Oi" }, { titulo: "  ", dica: "x" }] },
      { nome: "Consulta" },
    );
    expect(m.roteiro).toEqual([{ titulo: "Abertura", dica: "Oi" }]);
    expect(m.blocos.ia).toBe(false);
    expect(m.blocos.anotacoes).toBe(true);
  });
  it("lixo gravado cai no padrão do tipo", () => {
    expect(lerModeloDoTipo("x", { nome: "Consulta" }).modelo).toBe("padrao");
  });
});
