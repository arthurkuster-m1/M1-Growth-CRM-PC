import { describe, expect, it } from "vitest";

import {
  corpoDaAcao,
  exigeResultado,
  resultadosDaAcao,
  somarTagComContador,
  tituloDaAcao,
} from "./acoes-do-lead";

describe("tituloDaAcao", () => {
  it("usa o título da ação", () => {
    expect(tituloDaAcao("ligacao")).toBe("Follow Up - Ligação");
  });
  it("em 'Outra ação' vale o que a pessoa escreveu", () => {
    expect(tituloDaAcao("outro", "  Visitou a loja  ")).toBe("Visitou a loja");
  });
  it("'Outra ação' sem título cai no rótulo (a rota recusa antes)", () => {
    expect(tituloDaAcao("outro", "")).toBe("Outra ação");
  });
});

describe("corpoDaAcao", () => {
  it("resultado e comentário, um por linha", () => {
    expect(corpoDaAcao("Atendeu — pediu para retornar", "Ligar terça")).toBe(
      "Resultado: Atendeu — pediu para retornar\nLigar terça",
    );
  });
  it("sem nada, fica vazio", () => {
    expect(corpoDaAcao(undefined, "  ")).toBe("");
  });
});

describe("somarTagComContador", () => {
  it("primeira vez: a tag simples", () => {
    expect(somarTagComContador(["vip"], "No Show")).toEqual(["vip", "No Show"]);
  });
  it("segunda vez: vira 'No Show: 2x'", () => {
    expect(somarTagComContador(["vip", "No Show"], "No Show")).toEqual(["vip", "No Show: 2x"]);
  });
  it("terceira vez: 3x, sem diferenciar maiúsculas", () => {
    expect(somarTagComContador(["no show: 2x"], "No Show")).toEqual(["No Show: 3x"]);
  });
  it("não confunde com outra tag parecida", () => {
    expect(somarTagComContador(["No Show Total"], "No Show")).toEqual(["No Show Total", "No Show"]);
  });
  it("nome com caracteres especiais", () => {
    expect(somarTagComContador(["R$ (1)"], "R$ (1)")).toEqual(["R$ (1): 2x"]);
  });
});

describe("abordagens exigem resultado", () => {
  it("ligação, mensagem e e-mail não se registram sem resultado; o resto sim", () => {
    for (const id of ["ligacao", "mensagem", "email"]) expect(exigeResultado(id)).toBe(true);
    for (const id of ["reuniao", "proposta", "nao_atendeu", "outro"]) expect(exigeResultado(id)).toBe(false);
  });
  it("o decisor está nas sugestões de resultado", () => {
    expect(resultadosDaAcao("ligacao")).toContain("Atendeu — falou com o decisor");
    expect(resultadosDaAcao("email")).toContain("Respondeu — falou com o decisor");
  });
});
