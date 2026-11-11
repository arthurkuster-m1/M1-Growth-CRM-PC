import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  // A grade de verdade usa medidas de tela que o jsdom não tem: aqui ela vira uma lista simples
  // que mostra a situação de cada linha (o que a grade recebe é o que se testa).
  default: () =>
    function GradeFalsa({
      linhas,
    }: {
      linhas: Array<{ nome?: string; __tom?: string; __texto?: string }>;
    }) {
      return (
        <ul data-testid="grade">
          {linhas.map((l, i) => (
            <li key={i} data-tom={l.__tom ?? ""}>
              {l.nome}|{l.__texto}
            </li>
          ))}
        </ul>
      );
    },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ImportarProdutos } from "@/components/marketing/produtos/ImportarProdutos";

function abrir(existentes: string[] = []) {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <ImportarProdutos
        aberto
        aoFechar={() => {}}
        modulo="produtos-e-ofertas"
        existentes={existentes}
      />
    </QueryClientProvider>,
  );
}

describe("importar produtos colando na tabela", () => {
  it("o texto colado vira linhas, cada uma com a sua situação, e o botão conta as prontas", async () => {
    abrir(["Diagnóstico gratuito"]);
    fireEvent.click(screen.getByText("Colar da planilha"));
    fireEvent.change(screen.getByLabelText("Texto colado"), {
      target: {
        value:
          "nome\tetapa\tpreço\nGestão de tráfego\tprincipal\t1500,00\nDiagnóstico gratuito\tisca\t\nMentoria\tvip\t100\n",
      },
    });
    fireEvent.click(screen.getByText("Adicionar à tabela"));

    await waitFor(() => expect(screen.getAllByRole("listitem").length).toBeGreaterThan(3));
    const itens = screen.getAllByRole("listitem");
    const por = (nome: string) => itens.find((li) => li.textContent?.startsWith(`${nome}|`))!;
    expect(por("Gestão de tráfego").dataset.tom).toBe("ok");
    expect(por("Diagnóstico gratuito").dataset.tom).toBe("dup");
    expect(por("Mentoria").dataset.tom).toBe("erro");
    expect(screen.getByText("Importar 1 produto")).toBeTruthy();
    expect(screen.getByTestId("problemas").textContent).toMatch(/Etapa desconhecida/);
  });
});
