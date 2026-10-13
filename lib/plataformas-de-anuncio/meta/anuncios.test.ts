import { describe, expect, it } from "vitest";

import { anuncioDoMeta, linkDoAnuncio } from "./anuncios";

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
