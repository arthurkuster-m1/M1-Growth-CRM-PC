/**
 * As peças visuais da aba Marketing desenham sem quebrar e levam ao lugar certo.
 * (O painelzão em si é Server Component e passa por `requireAuth`; aqui se testa o que ele monta.)
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CartaoDeArea, CartaoDeModulo } from "@/components/marketing/Cartoes";
import { Atalho, OQueVem, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { nomeDaFase, textosDoModulo } from "@/components/marketing/textos";
import { MODULOS_DA_ESTRATEGIA, modulosDaFase } from "@/lib/marketing/modulos";

const t = (x: string) => x;

describe("aba Marketing — peças visuais", () => {
  it("o cartão de área é um link com título, descrição e estado", () => {
    render(
      <CartaoDeArea
        href="/app/marketing/estrategia"
        tom="orange"
        icone={<span />}
        titulo="Estratégia"
        descricao="O mapa da marca"
        estado="Em breve"
        abrir="Abrir"
      />,
    );
    const link = screen.getByRole("link", { name: /Estratégia/ });
    expect(link.getAttribute("href")).toBe("/app/marketing/estrategia");
    expect(screen.getByText("Em breve")).toBeTruthy();
    expect(screen.getByText("Abrir")).toBeTruthy();
  });

  it("o cartão de módulo mostra a fase e leva à página do módulo", () => {
    render(
      <CartaoDeModulo
        href="/app/marketing/estrategia/onboarding"
        tom="orange"
        icone={<span />}
        titulo="Onboarding"
        fase="01 | Diagnóstico"
        estado="Em breve"
      />,
    );
    expect(screen.getByRole("link", { name: /Onboarding/ }).getAttribute("href")).toBe(
      "/app/marketing/estrategia/onboarding",
    );
    expect(screen.getByText("01 | Diagnóstico")).toBeTruthy();
  });

  it("a página tem voltar, título, descrição e o bloco 'o que vem aqui'", () => {
    render(
      <PaginaDeMarketing
        tom="blue"
        icone={<span />}
        superior="Marketing"
        titulo="Dashboards"
        descricao="Números"
        estado="Em breve"
        voltar={{ href: "/app/marketing", rotulo: "Marketing" }}
      >
        <Atalho href="/app/metrics" titulo="Métricas" descricao="Os números" />
        <OQueVem titulo="O que vem aqui" itens={["Um", "Dois"]} />
      </PaginaDeMarketing>,
    );
    expect(screen.getByRole("heading", { level: 1, name: /Dashboards/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Marketing" }).getAttribute("href")).toBe(
      "/app/marketing",
    );
    expect(screen.getByRole("link", { name: /Métricas/ }).getAttribute("href")).toBe(
      "/app/metrics",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("módulos da estratégia", () => {
  it("todo módulo tem título e descrição (senão o cartão some do painel)", () => {
    for (const modulo of MODULOS_DA_ESTRATEGIA) {
      const textos = textosDoModulo(t, modulo.chave);
      expect(
        textos,
        `o módulo "${modulo.chave}" não tem texto em components/marketing/textos.ts`,
      ).not.toBeNull();
      expect(textos!.titulo.length).toBeGreaterThan(2);
      expect(textos!.descricao.length).toBeGreaterThan(8);
    }
  });

  it("chaves únicas, e as três fases do método têm módulos (3, 3 e 6)", () => {
    const chaves = MODULOS_DA_ESTRATEGIA.map((m) => m.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(modulosDaFase("diagnostico")).toHaveLength(3);
    expect(modulosDaFase("produto-e-oferta")).toHaveLength(3);
    expect(modulosDaFase("geracao-de-demanda")).toHaveLength(6);
  });

  it("o nome de cada fase segue o Notion do Arthur ('01 | Diagnóstico'…)", () => {
    expect(nomeDaFase(t, "diagnostico")).toBe("01 | Diagnóstico");
    expect(nomeDaFase(t, "produto-e-oferta")).toBe("02 | Produto e Oferta");
    expect(nomeDaFase(t, "geracao-de-demanda")).toBe("03 | Geração de Demanda");
  });
});
