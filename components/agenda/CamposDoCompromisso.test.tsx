import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { corDoTipo } from "@/lib/agenda/cor-do-tipo";

import { LocalEditavel } from "./CamposDoCompromisso";

describe("cor do tipo", () => {
  it("é sempre a mesma para o mesmo tipo e vem da paleta", () => {
    const id = "6f1d8a3e-0000-4000-8000-000000000001";
    expect(corDoTipo(id)).toBe(corDoTipo(id));
    expect(corDoTipo(id)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("local editável do compromisso", () => {
  const base = { estadoDoLink: null, linkDoMeet: null, podeEditar: true };

  it("presencial: o endereço se edita e grava ao sair do campo", () => {
    const salvar = vi.fn();
    render(<LocalEditavel {...base} tipo="in_person" detalhes="Rua A, 10" aoSalvar={salvar} />);
    const campo = screen.getByLabelText("Endereço");
    fireEvent.change(campo, { target: { value: "Rua B, 20" } });
    fireEvent.blur(campo);
    expect(salvar).toHaveBeenCalledWith("in_person", "Rua B, 20");
  });

  it("sem mudar nada, sair do campo não grava", () => {
    const salvar = vi.fn();
    render(<LocalEditavel {...base} tipo="in_person" detalhes="Rua A, 10" aoSalvar={salvar} />);
    fireEvent.blur(screen.getByLabelText("Endereço"));
    expect(salvar).not.toHaveBeenCalled();
  });

  it("link: o campo é o do link", () => {
    render(
      <LocalEditavel
        {...base}
        tipo="video_link"
        detalhes="https://meet.exemplo/x"
        aoSalvar={vi.fn()}
      />,
    );
    expect((screen.getByLabelText("Link da reunião") as HTMLInputElement).value).toBe(
      "https://meet.exemplo/x",
    );
  });

  it("Google Meet com link pendente ou com falha diz isso no lugar do link", () => {
    const { rerender } = render(
      <LocalEditavel
        {...base}
        tipo="google_meet"
        detalhes={null}
        estadoDoLink="pending"
        aoSalvar={vi.fn()}
      />,
    );
    expect(screen.getByText("Gerando o link…")).toBeTruthy();
    rerender(
      <LocalEditavel
        {...base}
        tipo="google_meet"
        detalhes={null}
        estadoDoLink="failed"
        aoSalvar={vi.fn()}
      />,
    );
    expect(screen.getByText("Falha ao gerar o link")).toBeTruthy();
  });

  it("quem não pode editar vê o texto, sem campo", () => {
    render(
      <LocalEditavel
        {...base}
        podeEditar={false}
        tipo="in_person"
        detalhes="Rua A, 10"
        aoSalvar={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Endereço")).toBeNull();
    expect(screen.getByText("Rua A, 10")).toBeTruthy();
  });
});
