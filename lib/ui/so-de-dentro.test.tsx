// @vitest-environment jsdom
/**
 * O dono de uma célula editável não pode engolir o clique da cortina de uma gaveta/popup que a
 * própria célula abriu (que vive num portal, mas é filha dela na árvore do React).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import { soDeDentro } from "./so-de-dentro";

function Cartao({ aoPai }: { aoPai: () => void }) {
  return (
    <div onPointerDown={aoPai}>
      <div data-testid="envoltorio" onPointerDown={soDeDentro}>
        <button data-testid="dentro">propriedade</button>
        {createPortal(<div data-testid="cortina">cortina</div>, document.body)}
      </div>
    </div>
  );
}

describe("soDeDentro", () => {
  it("o toque DENTRO da propriedade não chega ao cartão (não abre nem arrasta)", () => {
    const aoPai = vi.fn();
    render(<Cartao aoPai={aoPai} />);
    fireEvent.pointerDown(screen.getByTestId("dentro"));
    expect(aoPai).not.toHaveBeenCalled();
  });

  it("o toque na cortina do portal (fora do elemento) SEGUE em frente — a gaveta fecha ao clicar fora", () => {
    const aoPai = vi.fn();
    render(<Cartao aoPai={aoPai} />);
    fireEvent.pointerDown(screen.getByTestId("cortina"));
    expect(aoPai).toHaveBeenCalledTimes(1);
  });
});
