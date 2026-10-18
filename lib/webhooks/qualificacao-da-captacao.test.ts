import { describe, expect, it } from "vitest";

import { veioQualificado } from "./qualificacao-da-captacao";

describe("veioQualificado", () => {
  it("reconhece o campo de qualificado com valor afirmativo", () => {
    for (const valor of ["true", "TRUE", "1", "sim", "Sim", "yes", "s", " sim "]) {
      expect(veioQualificado({ nome: "Ana", qualificado: valor }), valor).toBe(true);
    }
    expect(veioQualificado({ qualified: "true" })).toBe(true);
    expect(veioQualificado({ mql: "1" })).toBe(true);
    expect(veioQualificado({ lead_qualificado: "sim" })).toBe(true);
  });

  it("vale também aninhado (o payload chega achatado, com o caminho na chave)", () => {
    expect(veioQualificado({ "respostas.qualificado": "sim" })).toBe(true);
    expect(veioQualificado({ "dados[qualificado]": "true" })).toBe(true);
  });

  it("sem o campo, ou com valor negativo/vazio, o lead não chega qualificado", () => {
    expect(veioQualificado({ nome: "Ana", telefone: "11999990000" })).toBe(false);
    for (const valor of ["false", "0", "nao", "não", "no", "n", "", "talvez"]) {
      expect(veioQualificado({ qualificado: valor }), valor).toBe(false);
    }
  });

  it("uma resposta que só CONTÉM a palavra (texto livre) não conta", () => {
    expect(veioQualificado({ comentario: "sim, qualificado" })).toBe(false);
  });
});
