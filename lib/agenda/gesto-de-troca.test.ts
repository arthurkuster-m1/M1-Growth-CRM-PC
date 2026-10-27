import { describe, expect, it } from "vitest";

import { direcaoDoGesto, gestoPodeComecarEm } from "./gesto-de-troca";

describe("gesto de trocar o período", () => {
  it("da direita para a esquerda avança; da esquerda para a direita volta", () => {
    expect(direcaoDoGesto(-120, 5)).toBe(1);
    expect(direcaoDoGesto(120, -5)).toBe(-1);
  });
  it("movimento curto não é gesto", () => {
    expect(direcaoDoGesto(-30, 0)).toBe(0);
  });
  it("rolar a página (mais vertical que horizontal) não troca o período", () => {
    expect(direcaoDoGesto(-80, 100)).toBe(0);
    expect(direcaoDoGesto(80, 70)).toBe(0);
  });
  it("não começa num cartão de compromisso nem num campo", () => {
    document.body.innerHTML =
      '<div id="a"><button data-testid="agendamento-1"><span id="b"></span></button><input id="c" /><p id="d"></p></div>';
    expect(gestoPodeComecarEm(document.getElementById("b"))).toBe(false);
    expect(gestoPodeComecarEm(document.getElementById("c"))).toBe(false);
    expect(gestoPodeComecarEm(document.getElementById("d"))).toBe(true);
  });
});
