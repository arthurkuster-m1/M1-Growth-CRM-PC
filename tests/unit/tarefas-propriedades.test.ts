import { describe, expect, it } from "vitest";

import {
  alteracoesDeCamposSchema,
  mesclarCamposPersonalizados,
  opcoesDePropriedadeSchema,
  validarValor,
  type PropriedadeDaTarefa,
} from "@/lib/tarefas/propriedades";

const ID_A = "00000000-0000-4000-8000-00000000000a";
const ID_B = "00000000-0000-4000-8000-00000000000b";
const ID_C = "00000000-0000-4000-8000-00000000000c";

const OPCOES = [
  { id: "o1", name: "Instagram", color: "pink" as const },
  { id: "o2", name: "Indicação", color: "green" as const },
];

const prop = (type: PropriedadeDaTarefa["type"], options = OPCOES) => ({ type, options });

describe("validarValor — cada tipo aceita o que faz sentido e recusa o resto", () => {
  it("vazio, null e undefined limpam o valor, em qualquer tipo", () => {
    for (const tipo of ["text", "number", "select", "date", "checkbox", "url"] as const) {
      expect(validarValor(prop(tipo), null)).toEqual({ ok: true, valor: null });
      expect(validarValor(prop(tipo), undefined)).toEqual({ ok: true, valor: null });
      expect(validarValor(prop(tipo), "")).toEqual({ ok: true, valor: null });
    }
    expect(validarValor(prop("multi_select"), [])).toEqual({ ok: true, valor: null });
  });

  it("texto: apara os espaços, trata só espaço como vazio e limita o tamanho", () => {
    expect(validarValor(prop("text"), "  Maria  ")).toEqual({ ok: true, valor: "Maria" });
    expect(validarValor(prop("text"), "   ")).toEqual({ ok: true, valor: null });
    expect(validarValor(prop("text"), "x".repeat(2001)).ok).toBe(false);
    expect(validarValor(prop("text"), 42).ok).toBe(false);
  });

  it("número: só número finito — texto, NaN e infinito são recusados", () => {
    expect(validarValor(prop("number"), 12.5)).toEqual({ ok: true, valor: 12.5 });
    expect(validarValor(prop("number"), 0)).toEqual({ ok: true, valor: 0 });
    expect(validarValor(prop("number"), "12").ok).toBe(false);
    expect(validarValor(prop("number"), Number.NaN).ok).toBe(false);
    expect(validarValor(prop("number"), Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(validarValor(prop("number"), 1e16).ok).toBe(false);
  });

  it("seleção: só id de opção que existe — nome digitado à mão não vale", () => {
    expect(validarValor(prop("select"), "o1")).toEqual({ ok: true, valor: "o1" });
    expect(validarValor(prop("select"), "Instagram").ok).toBe(false);
    expect(validarValor(prop("select"), "o99").ok).toBe(false);
    expect(validarValor(prop("select"), 1).ok).toBe(false);
  });

  it("seleção múltipla: lista de ids existentes, sem repetição", () => {
    expect(validarValor(prop("multi_select"), ["o1", "o2", "o1"])).toEqual({
      ok: true,
      valor: ["o1", "o2"],
    });
    expect(validarValor(prop("multi_select"), ["o1", "zzz"]).ok).toBe(false);
    expect(validarValor(prop("multi_select"), "o1").ok).toBe(false);
    expect(validarValor(prop("multi_select"), [1]).ok).toBe(false);
  });

  it("data: AAAA-MM-DD de um dia que existe", () => {
    expect(validarValor(prop("date"), "2026-10-08")).toEqual({ ok: true, valor: "2026-10-08" });
    expect(validarValor(prop("date"), "2028-02-29").ok).toBe(true);
    expect(validarValor(prop("date"), "2026-02-29").ok).toBe(false);
    expect(validarValor(prop("date"), "2026-02-31").ok).toBe(false);
    expect(validarValor(prop("date"), "08/10/2026").ok).toBe(false);
    expect(validarValor(prop("date"), "2026-10-08T10:00:00Z").ok).toBe(false);
  });

  it("caixa: só verdadeiro ou falso — e falso é um valor, não um 'vazio'", () => {
    expect(validarValor(prop("checkbox"), true)).toEqual({ ok: true, valor: true });
    expect(validarValor(prop("checkbox"), false)).toEqual({ ok: true, valor: false });
    expect(validarValor(prop("checkbox"), "true").ok).toBe(false);
    expect(validarValor(prop("checkbox"), 1).ok).toBe(false);
  });

  it("link: só http e https — javascript: e texto solto são recusados", () => {
    expect(validarValor(prop("url"), "https://m1.com.br/lp")).toEqual({
      ok: true,
      valor: "https://m1.com.br/lp",
    });
    expect(validarValor(prop("url"), "http://exemplo.com").ok).toBe(true);
    expect(validarValor(prop("url"), "javascript:alert(1)").ok).toBe(false);
    expect(validarValor(prop("url"), "m1.com.br").ok).toBe(false);
    expect(validarValor(prop("url"), "ftp://x.com").ok).toBe(false);
  });
});

describe("mesclarCamposPersonalizados", () => {
  const propriedades: PropriedadeDaTarefa[] = [
    { id: ID_A, organization_id: "o", name: "Cliente", type: "text", options: [], position: 1 },
    { id: ID_B, organization_id: "o", name: "Canal", type: "select", options: OPCOES, position: 2 },
  ];

  it("grava o valor novo e mantém os outros", () => {
    const r = mesclarCamposPersonalizados({ [ID_A]: "Maria" }, { [ID_B]: "o1" }, propriedades);
    expect(r).toEqual({ ok: true, campos: { [ID_A]: "Maria", [ID_B]: "o1" } });
  });

  it("null remove a chave", () => {
    const r = mesclarCamposPersonalizados(
      { [ID_A]: "Maria", [ID_B]: "o1" },
      { [ID_A]: null },
      propriedades,
    );
    expect(r).toEqual({ ok: true, campos: { [ID_B]: "o1" } });
  });

  it("id que não é de propriedade da organização é recusado — não vira dado novo", () => {
    const r = mesclarCamposPersonalizados({}, { [ID_C]: "x" }, propriedades);
    expect(r).toEqual({ ok: false, erro: "Propriedade inexistente.", propriedadeId: ID_C });
  });

  it("valor que não bate com o tipo é recusado, e nada é gravado pela metade", () => {
    const r = mesclarCamposPersonalizados(
      {},
      { [ID_A]: "ok", [ID_B]: "inexistente" },
      propriedades,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.propriedadeId).toBe(ID_B);
  });

  it("chave órfã (propriedade apagada) que a tarefa já tinha é preservada, inofensiva", () => {
    const r = mesclarCamposPersonalizados({ orfa: "x" }, { [ID_A]: "Maria" }, propriedades);
    expect(r).toEqual({ ok: true, campos: { orfa: "x", [ID_A]: "Maria" } });
  });

  it("não altera o objeto original", () => {
    const original = { [ID_A]: "Maria" };
    mesclarCamposPersonalizados(original, { [ID_A]: null }, propriedades);
    expect(original).toEqual({ [ID_A]: "Maria" });
  });
});

describe("os schemas de entrada", () => {
  it("opções: sem id repetido e sem nome repetido (ignorando a caixa)", () => {
    expect(opcoesDePropriedadeSchema.safeParse(OPCOES).success).toBe(true);
    expect(
      opcoesDePropriedadeSchema.safeParse([OPCOES[0], { ...OPCOES[1], id: "o1" }]).success,
    ).toBe(false);
    expect(
      opcoesDePropriedadeSchema.safeParse([OPCOES[0], { ...OPCOES[1], name: "INSTAGRAM" }]).success,
    ).toBe(false);
    expect(
      opcoesDePropriedadeSchema.safeParse([{ id: "x", name: "A", color: "neon" }]).success,
    ).toBe(false);
  });

  it("alterações de campos: chave tem de ser uuid", () => {
    expect(alteracoesDeCamposSchema.safeParse({ [ID_A]: "x" }).success).toBe(true);
    expect(alteracoesDeCamposSchema.safeParse({ "../etc": "x" }).success).toBe(false);
    expect(alteracoesDeCamposSchema.safeParse({ title: "x" }).success).toBe(false);
  });
});
