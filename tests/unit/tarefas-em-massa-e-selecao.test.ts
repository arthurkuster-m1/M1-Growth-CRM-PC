import { describe, expect, it } from "vitest";

import {
  MAXIMO_EM_MASSA,
  edicaoEmMassaSchema,
  exclusaoEmMassaSchema,
  mudancasEmMassaSchema,
} from "@/lib/tarefas/edicao-em-massa";
import { alternarId, estadoDoMarcarTodas, faixaEntre, podarSelecao } from "@/lib/motor/selecao";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("o que se pode mudar em massa", () => {
  it("aceita status (por opção), prioridade, responsável e prazo — e só isso", () => {
    expect(mudancasEmMassaSchema.safeParse({ status_option_id: uuid(1) }).success).toBe(true);
    expect(mudancasEmMassaSchema.safeParse({ priority: "urgent" }).success).toBe(true);
    expect(mudancasEmMassaSchema.safeParse({ assigned_to: null }).success).toBe(true);
    expect(mudancasEmMassaSchema.safeParse({ due_date: "2026-10-08T17:00:00.000Z" }).success).toBe(
      true,
    );
    expect(mudancasEmMassaSchema.safeParse({ due_date: null }).success).toBe(true);
  });

  it("recusa título e descrição (escrever o mesmo texto em 30 tarefas não é o que se quer)", () => {
    expect(mudancasEmMassaSchema.safeParse({ title: "x" }).success).toBe(false);
    expect(mudancasEmMassaSchema.safeParse({ description: "x" }).success).toBe(false);
    expect(mudancasEmMassaSchema.safeParse({ status: "done" }).success).toBe(false);
  });

  it("recusa pedido vazio, status nulo e valores fora do formato", () => {
    expect(mudancasEmMassaSchema.safeParse({}).success).toBe(false);
    expect(mudancasEmMassaSchema.safeParse({ status_option_id: null }).success).toBe(false);
    expect(mudancasEmMassaSchema.safeParse({ priority: "altíssima" }).success).toBe(false);
    expect(mudancasEmMassaSchema.safeParse({ assigned_to: "joao" }).success).toBe(false);
    expect(mudancasEmMassaSchema.safeParse({ due_date: "amanhã" }).success).toBe(false);
  });
});

describe("os ids do pedido", () => {
  it("de 1 a 200, só uuid, e repetido conta uma vez", () => {
    const r = edicaoEmMassaSchema.safeParse({
      ids: [uuid(1), uuid(2), uuid(1)],
      changes: { priority: "low" },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ids).toEqual([uuid(1), uuid(2)]);

    expect(edicaoEmMassaSchema.safeParse({ ids: [], changes: { priority: "low" } }).success).toBe(
      false,
    );
    expect(
      edicaoEmMassaSchema.safeParse({ ids: ["x"], changes: { priority: "low" } }).success,
    ).toBe(false);
    const demais = Array.from({ length: MAXIMO_EM_MASSA + 1 }, (_, i) => uuid(i + 1));
    expect(exclusaoEmMassaSchema.safeParse({ ids: demais }).success).toBe(false);
    expect(exclusaoEmMassaSchema.safeParse({ ids: demais.slice(0, MAXIMO_EM_MASSA) }).success).toBe(
      true,
    );
  });

  it("recusa campo desconhecido no pedido (não deixa passar um `organization_id`)", () => {
    expect(
      edicaoEmMassaSchema.safeParse({
        ids: [uuid(1)],
        changes: { priority: "low" },
        organization_id: uuid(9),
      }).success,
    ).toBe(false);
    expect(exclusaoEmMassaSchema.safeParse({ ids: [uuid(1)], todas: true }).success).toBe(false);
  });
});

describe("seleção de linhas", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("alternar liga e desliga, sem mexer no conjunto original", () => {
    const original = new Set(["a"]);
    const ligou = alternarId(original, "b");
    expect([...ligou].sort()).toEqual(["a", "b"]);
    expect([...alternarId(ligou, "a")]).toEqual(["b"]);
    expect([...original]).toEqual(["a"]);
  });

  it("a faixa do Shift vai de um clique ao outro, nos dois sentidos, na ordem da tabela", () => {
    expect(faixaEntre(ids, "b", "d")).toEqual(["b", "c", "d"]);
    expect(faixaEntre(ids, "d", "b")).toEqual(["b", "c", "d"]);
    expect(faixaEntre(ids, "c", "c")).toEqual(["c"]);
  });

  it("id que sumiu entre os cliques devolve só o clique atual", () => {
    expect(faixaEntre(ids, "zz", "d")).toEqual(["d"]);
    expect(faixaEntre(ids, "b", "zz")).toEqual(["zz"]);
  });

  it("poda: a seleção não aponta para linha que já não existe", () => {
    expect([...podarSelecao(new Set(["a", "x", "c"]), ids)].sort()).toEqual(["a", "c"]);
  });

  it("o estado do 'marcar todas': nenhuma, algumas, todas — e lista vazia é 'nenhuma'", () => {
    expect(estadoDoMarcarTodas(new Set(), ids)).toBe("nenhuma");
    expect(estadoDoMarcarTodas(new Set(["a", "b"]), ids)).toBe("algumas");
    expect(estadoDoMarcarTodas(new Set(ids), ids)).toBe("todas");
    expect(estadoDoMarcarTodas(new Set(["a"]), [])).toBe("nenhuma");
    // Marcada que não está mais na lista (filtro) não conta para "todas".
    expect(estadoDoMarcarTodas(new Set(["a", "x"]), ["a"])).toBe("todas");
  });
});
