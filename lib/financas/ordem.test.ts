import { describe, expect, it } from "vitest";
import { planejarReordem } from "./ordem";

const x = (id: string, ordem: number) => ({ id, nome: id, ordem });
const aplicar = (completa: ReturnType<typeof x>[], plano: { id: string; ordem: number }[]) => {
  const m = new Map(plano.map((p) => [p.id, p.ordem]));
  return [...completa]
    .map((c) => ({ ...c, ordem: m.get(c.id) ?? c.ordem }))
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => c.id);
};

describe("planejarReordem", () => {
  const todas = [x("a", 10), x("b", 20), x("c", 30), x("d", 40), x("e", 50)];
  it("reordena a lista inteira", () => {
    expect(
      aplicar(
        todas,
        planejarReordem(todas, [todas[2]!, todas[0]!, todas[1]!, todas[3]!, todas[4]!]),
      ),
    ).toEqual(["c", "a", "b", "d", "e"]);
  });
  it("reordena só um subconjunto sem tirar os de fora do lugar", () => {
    // b, d estão "em um grupo": trocar entre si não mexe em a, c, e
    expect(aplicar(todas, planejarReordem(todas, [todas[3]!, todas[1]!]))).toEqual([
      "a",
      "d",
      "c",
      "b",
      "e",
    ]);
  });
  it("só regrava o que mudou", () => {
    const plano = planejarReordem(todas, [todas[1]!, todas[0]!, todas[2]!, todas[3]!, todas[4]!]);
    expect(plano.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });
  it("funciona com ordens repetidas (tudo zero) e não devolve nada se nada mudou", () => {
    const zeros = [x("a", 0), x("b", 0), x("c", 0)];
    expect(aplicar(zeros, planejarReordem(zeros, [zeros[2]!, zeros[0]!, zeros[1]!]))).toEqual([
      "c",
      "a",
      "b",
    ]);
    const ok = [x("a", 10), x("b", 20)];
    expect(planejarReordem(ok, ok)).toEqual([]);
  });
  it("subconjunto inconsistente com a lista completa é ignorado", () => {
    expect(planejarReordem(todas, [x("z", 1)])).toEqual([]);
  });
});
