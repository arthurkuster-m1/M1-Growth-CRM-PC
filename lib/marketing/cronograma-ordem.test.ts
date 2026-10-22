import { describe, expect, it } from "vitest";

import type { ItemDoCronograma } from "./cronograma";
import { mudancasDeOrdem, moverAcao, moverFase, nomeNovoDeFase, nomesDasFases } from "./cronograma-ordem";

const item = (id: string, fase: string, ordem: number): ItemDoCronograma => ({
  id,
  acao: id,
  fase,
  ordem,
  semana_inicio: 1,
  semana_fim: 1,
  status: "planejado",
  destaque: false,
  notas: "",
  arquivado: false,
});

describe("ordem do cronograma", () => {
  const itens = [item("a1", "A", 10), item("a2", "A", 20), item("b1", "B", 30), item("s1", "", 40)];

  it("as fases seguem a ordem da primeira ação", () => {
    expect(nomesDasFases(itens)).toEqual(["A", "B"]);
  });

  it("descer uma ação troca só com a vizinha da mesma fase", () => {
    const m = moverAcao(itens, "a1", 1);
    expect(m).toEqual([
      { id: "a2", ordem: 10 },
      { id: "a1", ordem: 20 },
    ]);
    expect(moverAcao(itens, "a2", 1)).toEqual([]); // já é a última da fase
    expect(moverAcao(itens, "b1", -1)).toEqual([]); // única da fase
  });

  it("subir uma fase leva todas as ações dela", () => {
    const m = moverFase(itens, "B", -1);
    expect(m.map((x) => x.id).sort()).toEqual(["a1", "a2", "b1"]);
    expect(m.find((x) => x.id === "b1")!.ordem).toBe(10);
    expect(moverFase(itens, "A", -1)).toEqual([]);
  });

  it("nada a gravar quando a ordem já é essa", () => {
    expect(mudancasDeOrdem(itens, itens)).toEqual([]);
  });

  it("nome novo de fase não repete", () => {
    expect(nomeNovoDeFase(itens, "Nova fase")).toBe("Nova fase");
    expect(nomeNovoDeFase([...itens, item("n", "Nova fase", 50)], "Nova fase")).toBe("Nova fase 2");
  });
});
