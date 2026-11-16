import { describe, expect, it } from "vitest";

import {
  OcultosDaEstrategia,
  chaveDaFase,
  chaveDoAtalho,
  chavesDePaginaParaApagar,
  lerChaveOculta,
  paginasOcultaveisDaFase,
} from "./estrategia-oculta";

describe("o que se pode ocultar na Estratégia", () => {
  it("reconhece fase, página e atalho; recusa o essencial e o que não existe", () => {
    expect(lerChaveOculta("fase:diagnostico")).toEqual({ tipo: "fase", alvo: "diagnostico" });
    expect(lerChaveOculta("estudo-de-persona")).toEqual({
      tipo: "pagina",
      alvo: "estudo-de-persona",
    });
    expect(lerChaveOculta("atalho:analise-de-concorrencia")).toEqual({
      tipo: "atalho",
      alvo: "analise-de-concorrencia",
    });
    expect(lerChaveOculta("produtos-e-ofertas")).toBeNull();
    expect(lerChaveOculta("fase:inventada")).toBeNull();
    expect(lerChaveOculta("atalho:produtos-e-ofertas")).toBeNull();
    expect(lerChaveOculta("nao-existe")).toBeNull();
    // o módulo "semPagina" (abriga só as estratégias) não é uma página a ocultar
    expect(lerChaveOculta("estrategia-de-marketing")).toBeNull();
  });

  it("a fase 02 oculta as páginas dela, menos Produtos e ofertas", () => {
    const f2 = paginasOcultaveisDaFase("produto-e-oferta");
    expect(f2).toContain("estudo-de-persona");
    expect(f2).not.toContain("produtos-e-ofertas");
  });

  it("apagar uma página leva só ela (e suas subpáginas, pelo prefixo); uma fase, as páginas dela; um atalho, nada", () => {
    expect(chavesDePaginaParaApagar("estudo-de-persona")).toEqual(["estudo-de-persona"]);
    expect(chavesDePaginaParaApagar("fase:diagnostico")).toEqual(
      paginasOcultaveisDaFase("diagnostico"),
    );
    expect(chavesDePaginaParaApagar("fase:produto-e-oferta")).not.toContain("produtos-e-ofertas");
    expect(chavesDePaginaParaApagar("atalho:estudo-de-persona")).toEqual([]);
    expect(chavesDePaginaParaApagar("produtos-e-ofertas")).toEqual([]);
  });

  it("as perguntas da página: Produtos e ofertas nunca está oculto", () => {
    const o = new OcultosDaEstrategia(
      new Set([
        chaveDaFase("diagnostico"),
        "estudo-de-persona",
        chaveDoAtalho("estudo-de-persona"),
        "produtos-e-ofertas",
      ]),
    );
    expect(o.fase("diagnostico")).toBe(true);
    expect(o.fase("produto-e-oferta")).toBe(false);
    expect(o.pagina("estudo-de-persona")).toBe(true);
    expect(o.pagina("produtos-e-ofertas")).toBe(false);
    expect(o.atalho("estudo-de-persona")).toBe(true);
    expect(o.atalho("posicionamento-zmot")).toBe(false);
  });
});
