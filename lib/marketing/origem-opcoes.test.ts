import { describe, expect, it } from "vitest";

import { enderecoComparavel, fontesDeOrigem, montarOpcoesDeOrigem } from "./origem-opcoes";

describe("enderecoComparavel", () => {
  it("ignora esquema, www, query e barra final", () => {
    expect(enderecoComparavel("https://www.Site.com/bh/?utm_source=x")).toBe("site.com/bh");
    expect(enderecoComparavel("site.com/bh")).toBe("site.com/bh");
  });
});

describe("montarOpcoesDeOrigem", () => {
  const base = {
    campanhas: [{ id: "c1", name: "Seletiva BH", platform_campaigns: [{ id: "P1" }] }],
    criativos: [
      { id: "k1", name: "KIDS01", campaign_id: "c1", ad_id: "A1", link_url: "https://x.com/bh/?utm=1" },
      { id: "k2", name: "PLUS01", campaign_id: "c1", ad_id: "A2", link_url: "https://x.com/outra" },
      { id: "k3", name: "Manual", campaign_id: "c1", ad_id: null, link_url: "" },
    ],
    paginas: [
      { id: "p1", name: "LP BH", campaign_id: "c1", url: "https://www.x.com/bh" },
      { id: "p2", name: "LP Outra", campaign_id: "c1", url: "https://x.com/outra" },
    ],
    anuncioNoConjunto: [
      { ad_id: "A1", adset_id: "S1", adset_name: "Conjunto Frio", campaign_id: "P1" },
      { ad_id: "A2", adset_id: "S2", adset_name: "Conjunto Quente", campaign_id: "P1" },
    ],
    conjuntos: [{ adset_id: "S3", name: "Sem entrega", campaign_id: "P1" }],
  };
  it("campanha → conjunto → anúncio → página pelo link", () => {
    const [c] = montarOpcoesDeOrigem(base);
    expect(c!.conjuntos.map((x) => x.nome)).toEqual(["Conjunto Frio", "Conjunto Quente", "Sem entrega"]);
    const frio = c!.conjuntos.find((x) => x.id === "S1")!;
    expect(frio.anuncios[0]).toMatchObject({ nome: "KIDS01", pagina: { nome: "LP BH" } });
    const quente = c!.conjuntos.find((x) => x.id === "S2")!;
    expect(quente.anuncios[0]!.pagina?.nome).toBe("LP Outra");
  });
  it("anúncio sem conjunto vai para os soltos; sem link e com várias páginas, sem página", () => {
    const [c] = montarOpcoesDeOrigem(base);
    expect(c!.anuncios_soltos.map((x) => x.nome)).toEqual(["Manual"]);
    expect(c!.anuncios_soltos[0]!.pagina).toBeNull();
  });
  it("campanha com uma única página: ela vale para todos os anúncios", () => {
    const [c] = montarOpcoesDeOrigem({ ...base, paginas: [base.paginas[0]!] });
    expect(c!.anuncios_soltos[0]!.pagina?.nome).toBe("LP BH");
  });
});

describe("fontesDeOrigem", () => {
  it("fábrica + as que a organização já usou, sem repetir e sem as técnicas", () => {
    const f = fontesDeOrigem(["Extração Cartórios 2026", "instagram", "manual", "importacao_planilha", "  "]);
    expect(f).toContain("Instagram");
    expect(f).toContain("Extração Cartórios 2026");
    expect(f.filter((x) => x.toLowerCase() === "instagram")).toHaveLength(1);
    expect(f).not.toContain("manual");
    expect(f).not.toContain("importacao_planilha");
  });
});
