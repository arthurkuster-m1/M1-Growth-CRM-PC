import { describe, expect, it } from "vitest";

import { blocosDoModelo, lerModeloDoTipo, padraoDoModelo } from "./modelos-de-atendimento";

let n = 0;
const novoId = () => `b${++n}`;

describe("blocos com que a página do compromisso abre", () => {
  it("reunião de vendas: cada passo do roteiro vira título + dica + espaço para escrever", () => {
    const blocos = blocosDoModelo(padraoDoModelo("vendas"), novoId);
    const titulos = blocos
      .filter((b) => b.tipo === "titulo")
      .map((b) => (b as { texto: string }).texto);
    expect(titulos).toContain("Abertura");
    expect(titulos).toContain("Fechamento");
    expect(blocos.some((b) => b.tipo === "texto" && (b as { texto: string }).texto === "")).toBe(
      true,
    );
  });

  it("atendimento simples: só o espaço de anotações", () => {
    const blocos = blocosDoModelo(padraoDoModelo("padrao"), novoId);
    expect(blocos.map((b) => b.tipo)).toEqual(["titulo", "texto"]);
  });

  it("o modelo de blocos do tipo, quando existe, vale no lugar do gerado", () => {
    const cfg = lerModeloDoTipo(
      { modelo: "vendas", blocos_do_modelo: [{ id: "x", tipo: "texto", texto: "meu modelo" }] },
      { nome: "Reunião" },
    );
    expect(blocosDoModelo(cfg, novoId)).toEqual([{ id: "x", tipo: "texto", texto: "meu modelo" }]);
  });

  it("blocos inválidos gravados são ignorados (cai no gerado)", () => {
    const cfg = lerModeloDoTipo(
      { modelo: "padrao", blocos_do_modelo: [{ tipo: "nada" }] },
      { nome: "x" },
    );
    expect(cfg.blocos_do_modelo).toBeUndefined();
  });
});
