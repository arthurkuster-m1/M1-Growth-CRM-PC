import { describe, expect, it } from "vitest";

import {
  CAMPANHA_PADRAO_DAS_LPS,
  planejarOrigem,
  type CatalogoDeOrigem,
} from "./origem-da-importacao";

const cat: CatalogoDeOrigem = {
  campanhas: [
    { id: "c1", name: "Black Friday" },
    { id: "c2", name: "Verão" },
  ],
  criativos: [{ id: "a1", name: "Vídeo 1", campaign_id: "c1" }],
  paginas: [
    { id: "p1", name: "LP Principal", url: "https://www.site.com/oferta/?x=1", campaign_id: "c1" },
    { id: "p2", name: "LP Verão", url: "", campaign_id: "c2" },
  ],
};
const linha = (o: Partial<{ campanha: string; anuncio: string; landing_page: string }>) => ({
  campanha: null,
  anuncio: null,
  landing_page: null,
  ...o,
});

describe("planejarOrigem", () => {
  it("LP já cadastrada: liga pelo nome (sem acento nem caixa) e herda a campanha", () => {
    const p = planejarOrigem(linha({ landing_page: "lp principal" }), cat);
    expect(p).toMatchObject({ paginaId: "p1", campanhaId: "c1", paginaNova: null });
  });

  it("LP cadastrada: também casa pelo link", () => {
    const p = planejarOrigem(linha({ landing_page: "https://site.com/oferta" }), cat);
    expect(p.paginaId).toBe("p1");
  });

  it("LP que não existe, com campanha existente: será cadastrada nessa campanha", () => {
    const p = planejarOrigem(linha({ campanha: "black friday", landing_page: "LP Nova" }), cat);
    expect(p).toMatchObject({
      paginaId: null,
      campanhaId: "c1",
      campanhaNova: null,
      campanhaDaLp: "Black Friday",
      paginaNova: { nome: "LP Nova", url: "" },
    });
  });

  it("LP existente em OUTRA campanha não serve quando a linha diz a campanha", () => {
    const p = planejarOrigem(linha({ campanha: "Verão", landing_page: "LP Principal" }), cat);
    expect(p.paginaId).toBeNull();
    expect(p.paginaNova?.nome).toBe("LP Principal");
    expect(p.campanhaId).toBe("c2");
  });

  it("LP nova e campanha que também não existe: a campanha é criada com o nome da linha", () => {
    const p = planejarOrigem(linha({ campanha: "Natal", landing_page: "LP Natal" }), cat);
    expect(p).toMatchObject({ campanhaId: null, campanhaNova: "Natal", campanhaDaLp: "Natal" });
  });

  it("LP nova sem campanha na linha: vai para a campanha padrão (criada se preciso)", () => {
    const p = planejarOrigem(linha({ landing_page: "LP Solta" }), cat);
    expect(p).toMatchObject({ campanhaNova: CAMPANHA_PADRAO_DAS_LPS, campanhaId: null });
    const existente = planejarOrigem(linha({ landing_page: "LP Solta" }), {
      ...cat,
      campanhas: [...cat.campanhas, { id: "c9", name: CAMPANHA_PADRAO_DAS_LPS }],
    });
    expect(existente).toMatchObject({ campanhaId: "c9", campanhaNova: null });
  });

  it("LP escrita como link novo: o nome é o endereço e o link é guardado", () => {
    const p = planejarOrigem(linha({ landing_page: "https://www.nova.com/oferta/" }), cat);
    expect(p.paginaNova).toEqual({ nome: "nova.com/oferta", url: "https://www.nova.com/oferta/" });
  });

  it("sem LP: só campanha e anúncio existentes são ligados", () => {
    const p = planejarOrigem(linha({ campanha: "Black Friday", anuncio: "vídeo 1" }), cat);
    expect(p).toMatchObject({ campanhaId: "c1", criativoId: "a1", paginaNova: null });
    expect(planejarOrigem(linha({ campanha: "Inexistente" }), cat).campanhaId).toBeNull();
  });
});
