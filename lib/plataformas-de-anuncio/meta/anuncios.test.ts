import { describe, expect, it } from "vitest";

import { anuncioDoMeta, linkDoAnuncio, variacoesDoAnuncio } from "./anuncios";

describe("linkDoAnuncio — onde o Meta guarda a página de destino", () => {
  it("anúncio de link: object_story_spec.link_data.link", () => {
    expect(
      linkDoAnuncio({
        creative: { object_story_spec: { link_data: { link: "https://lp.exemplo.com/bh/" } } },
      }),
    ).toBe("https://lp.exemplo.com/bh/");
  });
  it("carrossel: o primeiro cartão com link", () => {
    expect(
      linkDoAnuncio({
        creative: {
          object_story_spec: {
            link_data: { child_attachments: [{}, { link: "https://lp.exemplo.com/c" }] },
          },
        },
      }),
    ).toBe("https://lp.exemplo.com/c");
  });
  it("vídeo: botão de chamada para ação", () => {
    expect(
      linkDoAnuncio({
        creative: {
          object_story_spec: {
            video_data: { call_to_action: { value: { link: "https://lp.exemplo.com/v" } } },
          },
        },
      }),
    ).toBe("https://lp.exemplo.com/v");
  });
  it("dinâmico: asset_feed_spec", () => {
    expect(
      linkDoAnuncio({
        creative: { asset_feed_spec: { link_urls: [{ website_url: "https://lp.exemplo.com/d" }] } },
      }),
    ).toBe("https://lp.exemplo.com/d");
  });
  it("sem link, ou link que não é http(s), fica vazio", () => {
    expect(linkDoAnuncio({ creative: {} })).toBe("");
    expect(
      linkDoAnuncio({ creative: { object_story_spec: { link_data: { link: "javascript:x" } } } }),
    ).toBe("");
  });
  it("o anúncio importado leva o link", () => {
    const a = anuncioDoMeta({
      id: "1",
      creative: { object_story_spec: { link_data: { link: "https://lp.exemplo.com/" } } },
    });
    expect(a?.link).toBe("https://lp.exemplo.com/");
  });
});

describe("variacoesDoAnuncio — todos os textos e imagens do anúncio", () => {
  it("anúncio dinâmico: 5 legendas, 5 títulos, 5 descrições", () => {
    const v = variacoesDoAnuncio({
      creative: {
        body: "L1",
        title: "T1",
        asset_feed_spec: {
          bodies: ["L1", "L2", "L3", "L4", "L5"].map((text) => ({ text })),
          titles: ["T1", "T2", "T3", "T4", "T5"].map((text) => ({ text })),
          descriptions: ["D1", "D2", "D3", "D4", "D5"].map((text) => ({ text })),
        },
      },
    });
    expect(v.legendas).toEqual(["L1", "L2", "L3", "L4", "L5"]);
    expect(v.titulos).toHaveLength(5);
    expect(v.descricoes).toEqual(["D1", "D2", "D3", "D4", "D5"]);
  });
  it("sem repetir e sem passar de 5", () => {
    const v = variacoesDoAnuncio({
      creative: {
        body: "A",
        asset_feed_spec: {
          bodies: ["A", " A ", "B", "C", "D", "E", "F"].map((text) => ({ text })),
        },
      },
    });
    expect(v.legendas).toEqual(["A", "B", "C", "D", "E"]);
  });
  it("carrossel: a imagem de cada cartão; hash sem endereço vai para a lista de hashes", () => {
    const v = variacoesDoAnuncio({
      creative: {
        image_url: "https://cdn.exemplo.com/a.jpg",
        object_story_spec: {
          link_data: {
            child_attachments: [
              { picture: "https://cdn.exemplo.com/b.jpg", name: "Cartão B" },
              { image_hash: "abcdef0123456789" },
            ],
          },
        },
      },
    });
    expect(v.imagens).toEqual(["https://cdn.exemplo.com/a.jpg", "https://cdn.exemplo.com/b.jpg"]);
    expect(v.hashesDeImagem).toEqual(["abcdef0123456789"]);
    expect(v.titulos).toEqual([]);
  });
  it("só aceita endereço https; no máximo 10 imagens", () => {
    const v = variacoesDoAnuncio({
      creative: {
        image_url: "http://inseguro.exemplo.com/a.jpg",
        asset_feed_spec: {
          images: Array.from({ length: 14 }, (_, i) => ({ url: `https://c.exemplo.com/${i}.jpg` })),
        },
      },
    });
    expect(v.imagens).toHaveLength(10);
    expect(v.imagens.every((u) => u.startsWith("https://"))).toBe(true);
  });
});
