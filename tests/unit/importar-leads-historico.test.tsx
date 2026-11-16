// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { celulaUnicaAlterada, useHistorico } from "@/components/clientes/importar/usar-historico";

const inicial = () => ({
  linhas: [{ titulo: "Ana" }, {}],
  visiveis: ["titulo", "telefone"],
  extras: [],
});

describe("useHistorico (Ctrl+Z da tabela de importar leads)", () => {
  it("desfaz e refaz mudanças de linhas e de colunas", () => {
    const { result } = renderHook(() => useHistorico(inicial));
    expect(result.current.podeDesfazer).toBe(false);

    act(() => result.current.mudar({ linhas: [{ titulo: "Bia" }, {}] }));
    act(() => result.current.mudar({ visiveis: ["titulo", "telefone", "email"] }));
    expect(result.current.estado.visiveis).toHaveLength(3);

    act(() => result.current.desfazer());
    expect(result.current.estado.visiveis).toEqual(["titulo", "telefone"]);
    expect(result.current.estado.linhas[0]).toEqual({ titulo: "Bia" });
    expect(result.current.podeRefazer).toBe(true);

    act(() => result.current.desfazer());
    expect(result.current.estado.linhas[0]).toEqual({ titulo: "Ana" });
    act(() => result.current.refazer());
    expect(result.current.estado.linhas[0]).toEqual({ titulo: "Bia" });

    // Uma mudança nova joga fora o que dava para refazer.
    act(() => result.current.mudar({ extras: ["Idade"] }));
    expect(result.current.podeRefazer).toBe(false);
  });

  it("juntas as letras digitadas na mesma célula numa mudança só", () => {
    const { result } = renderHook(() => useHistorico(inicial));
    act(() => result.current.mudar({ linhas: [{ titulo: "A" }, {}] }, "0|titulo"));
    act(() => result.current.mudar({ linhas: [{ titulo: "An" }, {}] }, "0|titulo"));
    act(() => result.current.mudar({ linhas: [{ titulo: "Ann" }, {}] }, "0|titulo"));
    act(() => result.current.desfazer());
    expect(result.current.estado.linhas[0]).toEqual({ titulo: "Ana" });
    expect(result.current.podeDesfazer).toBe(false);
  });

  it("Ctrl+Z e Ctrl+Y no teclado, mas não dentro de outros campos da página", () => {
    const { result } = renderHook(() => useHistorico(inicial));
    act(() => result.current.mudar({ linhas: [{ titulo: "Bia" }, {}] }));

    const outro = document.createElement("input");
    document.body.appendChild(outro);
    act(() => {
      outro.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    });
    expect(result.current.estado.linhas[0]).toEqual({ titulo: "Bia" });

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
      );
    });
    expect(result.current.estado.linhas[0]).toEqual({ titulo: "Ana" });
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true }),
      );
    });
    expect(result.current.estado.linhas[0]).toEqual({ titulo: "Bia" });
  });
});

describe("celulaUnicaAlterada", () => {
  it("acha a célula quando só uma mudou", () => {
    const a = [{ titulo: "A" }, { titulo: "B" }];
    expect(celulaUnicaAlterada(a, [{ titulo: "A" }, { titulo: "Bx" }])).toBe("1|titulo");
    expect(celulaUnicaAlterada(a, [{ titulo: "Ax" }, { titulo: "Bx" }])).toBeUndefined();
    expect(celulaUnicaAlterada(a, [...a, {}])).toBeUndefined();
  });
});
