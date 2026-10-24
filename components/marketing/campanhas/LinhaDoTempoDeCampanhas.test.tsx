import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { CampanhaDeDemanda } from "@/lib/marketing/campanhas";

import { LinhaDoTempoDeCampanhas } from "./LinhaDoTempoDeCampanhas";

beforeAll(() => {
  // O jsdom não traz o observador de tamanho que a linha do tempo usa para medir a largura.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(cleanup);

const campanha = (p: Partial<CampanhaDeDemanda>): CampanhaDeDemanda =>
  ({
    id: "c1",
    name: "[TESTE] TP",
    channel: "trafego_pago",
    status: "planejada",
    start_date: "2026-10-23",
    end_date: null,
    continuous: true,
    estado: null,
    ...p,
  }) as CampanhaDeDemanda;

function mostrar(aoStatus?: (id: string, status: CampanhaDeDemanda["status"]) => void) {
  render(
    <LinhaDoTempoDeCampanhas
      campanhas={[
        campanha({}),
        campanha({ id: "c2", name: "[TESTE] Prospecção", channel: "prospeccao" }),
      ]}
      base="/app/marketing/geracao-de-demanda/campanhas"
      fuso="America/Sao_Paulo"
      aoStatus={aoStatus}
    />,
  );
}

describe("LinhaDoTempoDeCampanhas — a coluna da campanha", () => {
  it("o bloco inteiro leva à campanha: o link cobre a célula, não só o título", () => {
    mostrar();
    const link = screen.getByRole("link", { name: "[TESTE] TP" });
    expect(link).toHaveAttribute("href", "/app/marketing/geracao-de-demanda/campanhas/c1");
    // Cobre a célula toda (posição absoluta, de ponta a ponta).
    expect(link.className).toContain("absolute");
    expect(link.className).toContain("inset-0");
  });

  it("o status se edita ali mesmo: escolher outro grava pelo callback, na campanha certa", () => {
    const aoStatus = vi.fn();
    mostrar(aoStatus);
    const [primeiro] = screen.getAllByRole("button", { name: /Status da campanha/ });
    fireEvent.click(primeiro!);
    fireEvent.click(screen.getByRole("button", { name: /Ativa/ }));
    expect(aoStatus).toHaveBeenCalledWith("c1", "ativa");
  });

  it("sem permissão de editar, o status só se vê (nenhuma lista abre)", () => {
    mostrar();
    const [primeiro] = screen.getAllByRole("button", { name: /Status da campanha/ });
    fireEvent.click(primeiro!);
    expect(screen.queryByRole("button", { name: /Encerrada/ })).toBeNull();
  });

  it("a linha de números não quebra, e a coluna estica para caber o texto mais longo", () => {
    const larguraDaColuna = () => {
      const linha = screen
        .getByRole("link", { name: "[TESTE] TP" })
        .closest("[style*='grid-template-columns']");
      return Number(/^(\d+)px/.exec((linha as HTMLElement).style.gridTemplateColumns)?.[1]);
    };
    // Sem números (estado vazio), a coluna fica no piso.
    mostrar();
    expect(larguraDaColuna()).toBe(340);
    for (const p of document.querySelectorAll("p.tabular-nums")) {
      expect(p.className).toContain("whitespace-nowrap");
    }
    cleanup();

    // Com "23/10 | Investido: R$ 5.927,80 | 1 Leads | CPL R$ 5.927,80", a coluna passa do piso.
    render(
      <LinhaDoTempoDeCampanhas
        campanhas={[
          campanha({
            estado: { de: "2026-10-23", ate: "2026-10-23", investido: 5927.8, leads: 1 },
          }),
        ]}
        base="/app/marketing/geracao-de-demanda/campanhas"
        fuso="America/Sao_Paulo"
      />,
    );
    expect(larguraDaColuna()).toBeGreaterThan(340);
    expect(larguraDaColuna()).toBeLessThanOrEqual(680);
  });
});
