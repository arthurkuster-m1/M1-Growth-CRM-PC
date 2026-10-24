import { describe, expect, it } from "vitest";

import {
  aplicarTagsAutomaticas,
  listarTagsAutomaticas,
  tagsAutomaticasDaAbordagem,
} from "./tags-automaticas";

describe("tagsAutomaticasDaAbordagem", () => {
  it("decisor implica contato; só contato não é decisor; sem resposta não marca nada", () => {
    expect(
      tagsAutomaticasDaAbordagem({ resultado: "Atendeu — falou com o decisor" }).fixas,
    ).toEqual(["Contato", "Contato com decisor"]);
    expect(tagsAutomaticasDaAbordagem({ resultado: "Atendeu — não é o decisor" }).fixas).toEqual([
      "Contato",
    ]);
    expect(tagsAutomaticasDaAbordagem({ resultado: "Não atendeu" }).fixas).toEqual([]);
    expect(tagsAutomaticasDaAbordagem({ resultado: "Sem resposta" }).fixas).toEqual([]);
  });

  it("a abordagem vira 'Abordagem: nome', cortada no limite de uma tag", () => {
    expect(tagsAutomaticasDaAbordagem({ abordagemNome: "Cold call" }).abordagem).toBe(
      "Abordagem: Cold call",
    );
    const longa = tagsAutomaticasDaAbordagem({
      abordagemNome: "Abordagem com um nome bem comprido demais",
    }).abordagem!;
    expect(longa.length).toBeLessThanOrEqual(30);
    expect(tagsAutomaticasDaAbordagem({ abordagemNome: "  " }).abordagem).toBeNull();
  });
});

describe("aplicarTagsAutomaticas", () => {
  const decisor = tagsAutomaticasDaAbordagem({
    resultado: "Atendeu — falou com o decisor",
    abordagemNome: "Cold call",
  });

  it("primeira vez: põe as três; as fixas não repetem e a abordagem ganha contador", () => {
    const primeira = aplicarTagsAutomaticas(["quente"], decisor);
    expect(primeira).toEqual(["quente", "Contato", "Contato com decisor", "Abordagem: Cold call"]);
    const segunda = aplicarTagsAutomaticas(primeira, decisor);
    expect(segunda).toEqual([
      "quente",
      "Contato",
      "Contato com decisor",
      "Abordagem: Cold call: 2x",
    ]);
    expect(aplicarTagsAutomaticas(segunda, decisor).at(-1)).toBe("Abordagem: Cold call: 3x");
  });

  it("reconhece a tag fixa sem diferenciar caixa e não mexe no resto", () => {
    expect(aplicarTagsAutomaticas(["contato"], { fixas: ["Contato"], abordagem: null })).toEqual([
      "contato",
    ]);
  });

  it("lista o que foi posto, para o histórico", () => {
    expect(listarTagsAutomaticas(decisor)).toEqual([
      "Contato",
      "Contato com decisor",
      "Abordagem: Cold call",
    ]);
  });
});
