import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SeletorDeData } from "./SeletorDeData";

/** O pai de verdade: guarda o valor que o seletor devolve. */
function Controlado({ inicial, aoMudar }: { inicial: string; aoMudar: (v: string) => void }) {
  const [valor, setValor] = useState(inicial);
  return (
    <SeletorDeData
      valor={valor}
      rotulo="Prazo"
      aoMudar={(v) => {
        setValor(v);
        aoMudar(v);
      }}
    />
  );
}

describe("SeletorDeData do cronograma", () => {
  it("a data se escreve no campo de cima (datas longe de hoje, de outros anos)", async () => {
    const aoMudar = vi.fn();
    render(<Controlado inicial="" aoMudar={aoMudar} />);
    await userEvent.click(screen.getByRole("button", { name: "Prazo" }));
    await userEvent.type(screen.getByPlaceholderText("dd/mm/aaaa"), "05/03/2029");
    expect(aoMudar).toHaveBeenLastCalledWith("2029-03-05");
  });

  it('"Hoje" escolhe o dia de hoje (não só volta o mês)', async () => {
    const aoMudar = vi.fn();
    render(<Controlado inicial="2029-03-05" aoMudar={aoMudar} />);
    await userEvent.click(screen.getByRole("button", { name: "Prazo" }));
    await userEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(aoMudar).toHaveBeenCalledTimes(1);
    expect(aoMudar.mock.calls[0]![0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(aoMudar.mock.calls[0]![0]).not.toBe("2029-03-05");
  });
});
