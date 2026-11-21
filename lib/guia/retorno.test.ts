import { describe, expect, it } from "vitest";

import { abaDoGuia, comRetornoAoGuia } from "./retorno";

describe("comRetornoAoGuia", () => {
  it("põe o Voltar apontando para a aba de onde a pessoa saiu", () => {
    expect(comRetornoAoGuia("/app/agenda")).toBe("/app/agenda?voltar=%2Fapp%2Fguia&vnome=Guia");
    expect(comRetornoAoGuia("/app/team?aba=atendimento", "plano")).toBe(
      "/app/team?aba=atendimento&voltar=%2Fapp%2Fguia%3Faba%3Dplano&vnome=Plano%20do%20Guia",
    );
  });

  it("o destino do Voltar é um caminho seguro do próprio app", async () => {
    const { caminhoSeguro } = await import("@/lib/navigation/voltar");
    for (const aba of ["guia", "plano", "ideias", "dossie"] as const) {
      const url = new URL(comRetornoAoGuia("/app/x", aba), "http://x");
      expect(caminhoSeguro(url.searchParams.get("voltar"))).toBe(true);
    }
  });
});

describe("abaDoGuia", () => {
  it("lê a aba do endereço e cai na primeira se for desconhecida", () => {
    expect(abaDoGuia("plano")).toBe("plano");
    expect(abaDoGuia("dossie")).toBe("dossie");
    expect(abaDoGuia("hack")).toBe("guia");
    expect(abaDoGuia(null)).toBe("guia");
    expect(abaDoGuia(undefined)).toBe("guia");
  });
});
