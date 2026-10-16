import { describe, expect, it, vi } from "vitest";

import { EVENTO_NOVO_COMPROMISSO, abrirNovoCompromisso } from "./abrir-novo";

describe("abrirNovoCompromisso", () => {
  it("avisa o casco do app com o cliente, a oportunidade e o horário pedidos", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_NOVO_COMPROMISSO, ouvinte);
    abrirNovoCompromisso({ contactId: "c1", leadId: "l1", startsAt: "2026-10-20T13:00:00.000Z" });
    window.removeEventListener(EVENTO_NOVO_COMPROMISSO, ouvinte);
    expect(ouvinte).toHaveBeenCalledOnce();
    expect((ouvinte.mock.calls[0]![0] as CustomEvent).detail).toEqual({
      contactId: "c1",
      leadId: "l1",
      startsAt: "2026-10-20T13:00:00.000Z",
    });
  });

  it("sem pedido nenhum, abre o formulário vazio", () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_NOVO_COMPROMISSO, ouvinte);
    abrirNovoCompromisso();
    window.removeEventListener(EVENTO_NOVO_COMPROMISSO, ouvinte);
    expect((ouvinte.mock.calls[0]![0] as CustomEvent).detail).toEqual({});
  });
});
