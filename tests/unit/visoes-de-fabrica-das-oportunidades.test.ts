import { describe, expect, it } from "vitest";

import {
  COLUNAS_DE_OPORTUNIDADES,
  MODELOS_DAS_OPORTUNIDADES,
  VISOES_DE_FABRICA_DAS_OPORTUNIDADES,
} from "@/lib/clientes/modelos-de-visao";

/**
 * As visualizações de fábrica das Oportunidades escolhem colunas por id. Um id que a tabela não
 * conhece some em silêncio, então o teste prende: todo id está na lista de colunas, sem repetição,
 * com o nome da oportunidade sempre na frente.
 */
describe("visões de fábrica das oportunidades", () => {
  it("a lista de colunas não repete id", () => {
    expect(new Set(COLUNAS_DE_OPORTUNIDADES).size).toBe(COLUNAS_DE_OPORTUNIDADES.length);
  });

  for (const m of VISOES_DE_FABRICA_DAS_OPORTUNIDADES) {
    it(`${m.nome}: só usa colunas conhecidas, começa pelo nome e esconde o resto`, () => {
      const ordem = m.config.ordem ?? [];
      expect(ordem[0]).toBe("nome");
      expect(new Set(ordem).size).toBe(ordem.length);
      expect([...ordem].sort()).toEqual([...COLUNAS_DE_OPORTUNIDADES].sort());
      const visiveis = Object.entries(m.config.visiveis ?? {}).filter(([, v]) => v);
      expect(visiveis.length).toBeGreaterThan(3);
    });
  }

  it("os nomes são únicos e o Radar continua oferecido", () => {
    const nomes = MODELOS_DAS_OPORTUNIDADES.map((m) => m.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
    expect(nomes).toContain("Radar");
  });
});
