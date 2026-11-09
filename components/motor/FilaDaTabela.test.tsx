/**
 * A fila padrão de toda tabela do app (como no Notion): visualizações à esquerda; à direita, no
 * fim da MESMA fila, a busca em lupa e filtrar/ordenar/agrupar só em ícone — cinza sem nada
 * aplicado, azul quando há algo valendo.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { AbasDeVisualizacao } from "@/components/motor/AbasDeVisualizacao";
import { BarraDeConsulta } from "@/components/motor/BarraDeConsulta";
import { BuscaEmLupa } from "@/components/motor/BuscaEmLupa";
import type { ConsultaDaTabela } from "@/lib/motor/consulta";

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));

const CAMPOS = [{ id: "nome", titulo: "Nome", tipo: "texto" as const }];

function Fila({ consulta }: { consulta: ConsultaDaTabela }) {
  const [busca, setBusca] = useState("");
  return (
    <AbasDeVisualizacao
      abas={[{ id: "a", nome: "Envios", tipo: "tabela" }]}
      ativaId="a"
      podeEditar
      aoEscolher={() => undefined}
      aoCriar={() => undefined}
      aoConfigurar={() => undefined}
      direita={
        <>
          <BuscaEmLupa valor={busca} aoMudar={setBusca} placeholder="Buscar tarefas" />
          <BarraDeConsulta campos={CAMPOS} consulta={consulta} aoMudar={() => undefined} />
          <button type="button">Novo</button>
        </>
      }
    />
  );
}

describe("fila das visualizações", () => {
  it("filtrar, ordenar, agrupar e a lupa são só ícones, fora da lista de abas e junto do Novo", () => {
    render(<Fila consulta={{}} />);
    const abas = screen.getByRole("tablist");
    for (const nome of ["Filtrar", "Ordenar", "Agrupar", "Buscar"]) {
      const b = screen.getByRole("button", { name: nome });
      expect(b.textContent).toBe(""); // só o ícone
      expect(abas.contains(b)).toBe(false); // à direita, não dentro das abas
      expect(b.closest(".flex.shrink-0")).toBe(screen.getByRole("button", { name: "Novo" }).closest(".flex.shrink-0"));
    }
    expect(within(abas).getByRole("tab", { name: "Envios" })).toBeTruthy();
  });

  it("sem nada aplicado os ícones são cinza; com filtro, ordem ou grupo ficam azuis", () => {
    const { rerender } = render(<Fila consulta={{}} />);
    expect(screen.getByRole("button", { name: "Filtrar" }).className).toMatch(/text-muted-foreground/);
    expect(screen.getByRole("button", { name: "Filtrar" }).className).not.toMatch(/text-primary/);

    rerender(
      <Fila
        consulta={{
          filtros: [{ campo: "nome", operador: "contem", valor: "a" }],
          ordenacao: [{ campo: "nome", direcao: "asc" }],
          agrupar: "nome",
        }}
      />,
    );
    for (const nome of ["Filtrar (1)", "Ordenar (1)", "Agrupar (1)"]) {
      expect(screen.getByRole("button", { name: nome }).className).toMatch(/text-primary/);
    }
  });

  it("a lupa abre o campo, fica azul com texto, e Esc limpa e volta a ser só o ícone", () => {
    render(<Fila consulta={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const campo = screen.getByPlaceholderText("Buscar tarefas");
    fireEvent.change(campo, { target: { value: "env" } });
    expect((campo as HTMLInputElement).value).toBe("env");
    fireEvent.keyDown(campo, { key: "Escape" });
    expect(screen.queryByPlaceholderText("Buscar tarefas")).toBeNull();
    expect(screen.getByRole("button", { name: "Buscar" })).toBeTruthy();
  });
});
