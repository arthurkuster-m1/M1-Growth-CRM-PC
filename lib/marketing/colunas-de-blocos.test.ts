import { describe, expect, it } from "vitest";

import { blocoEmBranco, type Bloco } from "@/lib/marketing/blocos";
import {
  agruparPorLinha,
  juntarComOAnterior,
  juntarEmLinha,
  removerBlocos,
  separarDaLinha,
} from "@/lib/marketing/edicao-de-blocos";

const b = (id: string): Bloco => blocoEmBranco("texto", id);
const lista = () => [b("a"), b("b"), b("c"), b("d")];

describe("colunas de blocos", () => {
  it("junta os escolhidos onde está o primeiro", () => {
    const r = juntarEmLinha(lista(), new Set(["b", "d"]), "L");
    expect(r.map((x) => x.id)).toEqual(["a", "b", "d", "c"]);
    expect(agruparPorLinha(r).map((g) => g.map((x) => x.id))).toEqual([["a"], ["b", "d"], ["c"]]);
  });

  it("ao lado do bloco de cima, e acumula até 4 colunas", () => {
    let r = juntarComOAnterior(lista(), "b", "L");
    r = juntarComOAnterior(r, "c", "M");
    r = juntarComOAnterior(r, "d", "N");
    expect(agruparPorLinha(r)).toHaveLength(1);
    expect(r.every((x) => x.linha === "L")).toBe(true);
    const cinco = [...r, b("e")];
    expect(juntarComOAnterior(cinco, "e", "Z")).toBe(cinco);
  });

  it("quem sobra sozinho numa linha volta à largura toda", () => {
    const r = juntarEmLinha(lista(), new Set(["a", "b"]), "L");
    expect(separarDaLinha(r, new Set(["a"])).every((x) => !x.linha)).toBe(true);
    expect(removerBlocos(r, new Set(["a"])).every((x) => !x.linha)).toBe(true);
  });
});
