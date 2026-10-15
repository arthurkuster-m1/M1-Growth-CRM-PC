import { describe, expect, it } from "vitest";

import { contarOrigemDosLeads, type LeadDaOrigem } from "./origem-dos-leads";

const lead = (p: Partial<LeadDaOrigem> & { contato: string }): LeadDaOrigem => ({
  criativoId: null,
  landingPageId: null,
  conjuntoId: null,
  conjuntoNome: null,
  ...p,
});

describe("contarOrigemDosLeads: desqualificados e MQL", () => {
  it("conta pessoas distintas desqualificadas por criativo, LP e conjunto", () => {
    const r = contarOrigemDosLeads([
      lead({ contato: "a", criativoId: "c1", landingPageId: "p1", conjuntoId: "s1", desqualificado: true }),
      lead({ contato: "a", criativoId: "c1", landingPageId: "p1", conjuntoId: "s1", desqualificado: true }),
      lead({ contato: "b", criativoId: "c1", landingPageId: "p1", conjuntoId: "s1", mql: true }),
      lead({ contato: "c", criativoId: "c2", landingPageId: "p1", conjuntoId: "s2" }),
    ]);
    expect(r.porCriativo).toEqual({ c1: 2, c2: 1 });
    expect(r.desqualificadosPorCriativo).toEqual({ c1: 1 });
    expect(r.mqlPorCriativo).toEqual({ c1: 1 });
    expect(r.desqualificadosPorLandingPage).toEqual({ p1: 1 });
    expect(r.porConjunto.find((c) => c.id === "s1")?.desqualificados).toBe(1);
    expect(r.porConjunto.find((c) => c.id === "s2")?.desqualificados).toBe(0);
  });
});
