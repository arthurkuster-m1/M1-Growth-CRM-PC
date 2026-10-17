import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let parametros = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => parametros }));

import { BotaoVoltar, comVoltar } from "./BotaoVoltar";

describe("BotaoVoltar", () => {
  it("o atalho leva a origem no endereço e a página de destino mostra o Voltar", () => {
    const href = comVoltar("/app/clientes", {
      href: "/app/marketing/geracao-de-demanda",
      rotulo: "Campanhas",
    });
    parametros = new URL(href, "http://x").searchParams;
    render(<BotaoVoltar />);
    const link = screen.getByRole("link", { name: /Voltar para Campanhas/ });
    expect(link.getAttribute("href")).toBe("/app/marketing/geracao-de-demanda");
  });

  it("sem o parâmetro não aparece nada", () => {
    parametros = new URLSearchParams();
    render(<BotaoVoltar />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("nunca volta para fora do app", () => {
    for (const ruim of ["https://exemplo.com", "//exemplo.com", "/outra", "/app/..\\x"]) {
      parametros = new URLSearchParams({ voltar: ruim });
      const { unmount } = render(<BotaoVoltar />);
      expect(screen.queryByRole("link"), ruim).toBeNull();
      unmount();
    }
  });
});
