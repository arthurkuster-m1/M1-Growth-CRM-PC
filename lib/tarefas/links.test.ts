import { describe, expect, it } from "vitest";

import { partirEmLinks, rotuloDoLink, temLink } from "./links";

describe("links da descrição", () => {
  it("parte o texto em pedaços de texto e de link", () => {
    expect(partirEmLinks("veja https://www.instagram.com/p/DaLmczvFKMk/ agora")).toEqual([
      { tipo: "texto", valor: "veja " },
      { tipo: "link", valor: "https://www.instagram.com/p/DaLmczvFKMk/" },
      { tipo: "texto", valor: " agora" },
    ]);
  });

  it("não leva a pontuação da frase nem o parêntese que não abriu", () => {
    const [, a] = partirEmLinks("(https://x.com/a), e https://x.com/b.");
    expect(a).toEqual({ tipo: "link", valor: "https://x.com/a" });
    const links = partirEmLinks("(https://x.com/a), e https://x.com/b.").filter(
      (s) => s.tipo === "link",
    );
    expect(links.map((l) => l.valor)).toEqual(["https://x.com/a", "https://x.com/b"]);
  });

  it("mantém o parêntese que faz parte do endereço", () => {
    const [l] = partirEmLinks("https://pt.wikipedia.org/wiki/Foo_(bar)");
    expect(l).toEqual({ tipo: "link", valor: "https://pt.wikipedia.org/wiki/Foo_(bar)" });
  });

  it("texto sem link e 'https://' solto não são link", () => {
    expect(temLink("nada aqui")).toBe(false);
    expect(temLink("https:// sozinho")).toBe(false);
    expect(temLink("http://a.com")).toBe(true);
  });

  it("dá nome aos sites conhecidos e ao resto usa o domínio", () => {
    expect(rotuloDoLink("https://www.instagram.com/p/DaLmczvFKMk/?img_index=11")).toEqual({
      site: "Instagram",
      detalhe: "/p/DaLmczvFKMk",
    });
    expect(rotuloDoLink("https://docs.google.com/spreadsheets/d/abc/edit").site).toBe(
      "Google Sheets",
    );
    expect(rotuloDoLink("https://www.exemplo.com.br/")).toEqual({
      site: "exemplo.com.br",
      detalhe: "",
    });
  });
});
