import { describe, expect, it } from "vitest";

import { SEM_FILTRO, atendeAoFiltro, filtroEstaAtivo, tipoDoTelefone } from "./qualidade";

const empresa = {
  phone: "+5541988887777",
  website: "https://exemplo.com.br",
  category: "Clínica de estética",
  rating: 4.6,
  reviews: 120,
};

describe("tipoDoTelefone", () => {
  it("separa celular de fixo no padrão brasileiro", () => {
    expect(tipoDoTelefone("+5541988887777")).toBe("celular"); // 11 dígitos, 9 na frente
    expect(tipoDoTelefone("+554133334444")).toBe("fixo"); // 10 dígitos, começa em 3
    expect(tipoDoTelefone("+554188887777")).toBe("celular"); // 10 dígitos antigos, começa em 8
    expect(tipoDoTelefone("+5541388887777")).toBeNull(); // 11 dígitos sem o 9: não existe
    expect(tipoDoTelefone(null)).toBeNull();
    expect(tipoDoTelefone("+14155550100")).toBeNull(); // nunca adivinha outro país
  });
});

describe("atendeAoFiltro", () => {
  it("sem filtro, todas atendem — inclusive as sem nota", () => {
    expect(filtroEstaAtivo(SEM_FILTRO)).toBe(false);
    expect(atendeAoFiltro({ ...empresa, rating: null }, SEM_FILTRO)).toBe(true);
  });

  it("nota e avaliações mínimas: quem não tem o dado não atende", () => {
    expect(atendeAoFiltro(empresa, { ...SEM_FILTRO, notaMinima: 4.5 })).toBe(true);
    expect(atendeAoFiltro(empresa, { ...SEM_FILTRO, notaMinima: 4.8 })).toBe(false);
    expect(atendeAoFiltro({ ...empresa, rating: null }, { ...SEM_FILTRO, notaMinima: 3 })).toBe(
      false,
    );
    expect(atendeAoFiltro(empresa, { ...SEM_FILTRO, avaliacoesMinimas: 100 })).toBe(true);
    expect(
      atendeAoFiltro({ ...empresa, reviews: null }, { ...SEM_FILTRO, avaliacoesMinimas: 1 }),
    ).toBe(false);
  });

  it("só com site, só celular e categoria (sem acento nem caixa)", () => {
    expect(atendeAoFiltro({ ...empresa, website: null }, { ...SEM_FILTRO, soComSite: true })).toBe(
      false,
    );
    expect(
      atendeAoFiltro({ ...empresa, phone: "+554133334444" }, { ...SEM_FILTRO, soCelular: true }),
    ).toBe(false);
    expect(atendeAoFiltro(empresa, { ...SEM_FILTRO, soCelular: true })).toBe(true);
    expect(atendeAoFiltro(empresa, { ...SEM_FILTRO, categoria: "CLINICA" })).toBe(true);
    expect(atendeAoFiltro(empresa, { ...SEM_FILTRO, categoria: "dentista" })).toBe(false);
  });

  it("só com WhatsApp confirmado: quem não foi verificado ou ficou incerto não passa", () => {
    const f = { ...SEM_FILTRO, soComWhatsapp: true };
    expect(filtroEstaAtivo(f)).toBe(true);
    expect(atendeAoFiltro({ ...empresa, whatsapp: "exists" }, f)).toBe(true);
    for (const w of ["missing", "unknown", null, undefined]) {
      expect(atendeAoFiltro({ ...empresa, whatsapp: w }, f)).toBe(false);
    }
  });

  it("os critérios somam: tem de passar em todos", () => {
    const f = { ...SEM_FILTRO, notaMinima: 4, soCelular: true, soComSite: true };
    expect(atendeAoFiltro(empresa, f)).toBe(true);
    expect(atendeAoFiltro({ ...empresa, website: "" }, f)).toBe(false);
  });
});
