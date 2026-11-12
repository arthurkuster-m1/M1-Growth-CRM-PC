import { describe, expect, it } from "vitest";

import {
  alturaDaSubarvore,
  caminhoDaNota,
  edicaoDeNotaSchema,
  estaDentroDe,
  idsDaSubarvore,
  montarArvore,
  novaNotaSchema,
  profundidadeDaNota,
  type ResumoDaNota,
} from "@/lib/anotacoes/paginas";

function nota(id: string, parent: string | null, position = 1, extra: Partial<ResumoDaNota> = {}) {
  return {
    id,
    parent_id: parent,
    title: id,
    icon: null,
    position,
    visible_to_client: false,
    kind: null,
    deleted_at: null,
    updated_at: "2026-11-12T00:00:00Z",
    ...extra,
  } satisfies ResumoDaNota;
}

const lista = [
  nota("a", null, 2),
  nota("b", null, 1),
  nota("a1", "a", 2),
  nota("a2", "a", 1),
  nota("a2x", "a2", 1),
];

describe("anotações — árvore de páginas", () => {
  it("monta a árvore ordenada por posição, com as filhas dentro da mãe", () => {
    const arvore = montarArvore(lista);
    expect(arvore.map((n) => n.nota.id)).toEqual(["b", "a"]);
    expect(arvore[1]!.filhas.map((n) => n.nota.id)).toEqual(["a2", "a1"]);
    expect(arvore[1]!.filhas[0]!.filhas.map((n) => n.nota.id)).toEqual(["a2x"]);
  });

  it("uma página cuja mãe não está na lista vira raiz (o cliente vê só parte da árvore)", () => {
    const arvore = montarArvore([nota("filha", "mae-escondida"), nota("solta", null)]);
    expect(arvore.map((n) => n.nota.id).sort()).toEqual(["filha", "solta"]);
  });

  it("não trava com um ciclo vindo de dado ruim", () => {
    const arvore = montarArvore([nota("x", "y"), nota("y", "x")]);
    expect(arvore).toEqual([]);
  });

  it("lista a página e tudo que está dentro dela", () => {
    expect(idsDaSubarvore(lista, "a").sort()).toEqual(["a", "a1", "a2", "a2x"]);
    expect(idsDaSubarvore(lista, "b")).toEqual(["b"]);
  });

  it("sabe se uma página está dentro de outra (para recusar mover para dentro de si)", () => {
    expect(estaDentroDe(lista, "a2x", "a")).toBe(true);
    expect(estaDentroDe(lista, "a", "a")).toBe(true);
    expect(estaDentroDe(lista, "b", "a")).toBe(false);
  });

  it("mede o caminho, a profundidade e a altura da subárvore", () => {
    expect(caminhoDaNota(lista, "a2x").map((n) => n.id)).toEqual(["a", "a2", "a2x"]);
    expect(profundidadeDaNota(lista, "a2x")).toBe(3);
    expect(alturaDaSubarvore(lista, "a")).toBe(3);
    expect(alturaDaSubarvore(lista, "b")).toBe(1);
  });
});

describe("anotações — validação de entrada", () => {
  it("criar: pai nulo e título vazio por padrão", () => {
    expect(novaNotaSchema.parse({})).toEqual({ parent_id: null, title: "" });
  });

  it("criar: recusa pai que não é id", () => {
    expect(novaNotaSchema.safeParse({ parent_id: "oi" }).success).toBe(false);
  });

  it("editar: pede ao menos um campo e recusa título gigante", () => {
    expect(edicaoDeNotaSchema.safeParse({}).success).toBe(false);
    expect(edicaoDeNotaSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
    expect(edicaoDeNotaSchema.safeParse({ title: "Reunião", icon: "📝" }).success).toBe(true);
    expect(edicaoDeNotaSchema.safeParse({ icon: null }).success).toBe(true);
  });

  it("editar: o conteúdo é a lista de blocos do editor, cada um com id e type", () => {
    const ok = [{ id: "1", type: "paragraph", props: {}, content: [], children: [] }];
    expect(edicaoDeNotaSchema.safeParse({ blocks: ok }).success).toBe(true);
    expect(edicaoDeNotaSchema.safeParse({ blocks: [] }).success).toBe(true);
    expect(edicaoDeNotaSchema.safeParse({ blocks: [{ tipo: "texto", id: "1" }] }).success).toBe(
      false,
    );
    expect(edicaoDeNotaSchema.safeParse({ blocks: "texto" }).success).toBe(false);
  });
});
