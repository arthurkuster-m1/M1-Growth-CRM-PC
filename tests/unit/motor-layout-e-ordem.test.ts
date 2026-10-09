import { describe, expect, it } from "vitest";

import { deCampoLocal, paraCampoLocal, rotuloDaData } from "@/lib/motor/datas-do-campo";
import {
  LARGURA_MAXIMA,
  LARGURA_MINIMA,
  limitarLargura,
  moverColuna,
  preferenciasDaTabelaSchema,
  resolverColunas,
  type DefinicaoDeColuna,
} from "@/lib/motor/layout";
import { lacunaAcabou, moverNaLista, posicaoEntre, renumerar } from "@/lib/motor/ordem";

const DEFINICOES: DefinicaoDeColuna[] = [
  { id: "titulo", largura: 340, fixa: true },
  { id: "status", largura: 190 },
  { id: "prioridade", largura: 140 },
  { id: "prazo", largura: 170 },
  { id: "descricao", largura: 280, padrao: false },
];

describe("coluna que não se oculta (semOcultar): o título do Notion", () => {
  const defs: DefinicaoDeColuna[] = [
    { id: "titulo", largura: 340, semOcultar: true },
    { id: "status", largura: 190 },
    { id: "prazo", largura: 170 },
  ];
  it("pode ir para outro lugar na ordem, mas continua sempre visível", () => {
    const r = resolverColunas(defs, {
      ordem: ["status", "titulo", "prazo"],
      visiveis: { titulo: false },
    });
    expect(r.map((c) => c.id)).toEqual(["status", "titulo", "prazo"]);
    expect(r.find((c) => c.id === "titulo")?.visivel).toBe(true);
  });
});

const ids = (colunas: { id: string }[]) => colunas.map((c) => c.id);

describe("resolverColunas", () => {
  it("sem preferência: a ordem e a largura de fábrica, e só o que começa visível", () => {
    const r = resolverColunas(DEFINICOES, undefined);
    expect(ids(r)).toEqual(["titulo", "status", "prioridade", "prazo", "descricao"]);
    expect(r.filter((c) => c.visivel).map((c) => c.id)).toEqual([
      "titulo",
      "status",
      "prioridade",
      "prazo",
    ]);
    expect(r.find((c) => c.id === "status")?.largura).toBe(190);
  });

  it("a ordem escolhida vale, e a coluna fixa continua sendo a primeira", () => {
    const r = resolverColunas(DEFINICOES, { ordem: ["prazo", "titulo", "status"] });
    // `titulo` é fixa: mesmo listada no meio da ordem, não sai do primeiro lugar.
    expect(ids(r)).toEqual(["titulo", "prazo", "status", "prioridade", "descricao"]);
  });

  it("coluna nova (que a pessoa nunca viu) vai para o fim, na largura de fábrica", () => {
    const r = resolverColunas(DEFINICOES, { ordem: ["status", "prazo"] });
    expect(ids(r)).toEqual(["titulo", "status", "prazo", "prioridade", "descricao"]);
  });

  it("id que a tela não declara mais é ignorado — não quebra nada", () => {
    const r = resolverColunas(DEFINICOES, {
      ordem: ["fantasma", "prazo"],
      larguras: { fantasma: 300 },
      visiveis: { fantasma: true },
    });
    expect(ids(r)).toEqual(["titulo", "prazo", "status", "prioridade", "descricao"]);
  });

  it("largura escolhida vale, dentro dos limites", () => {
    const r = resolverColunas(DEFINICOES, {
      larguras: { status: 260, prazo: 5, prioridade: 5000 },
    });
    expect(r.find((c) => c.id === "status")?.largura).toBe(260);
    expect(r.find((c) => c.id === "prazo")?.largura).toBe(LARGURA_MINIMA);
    expect(r.find((c) => c.id === "prioridade")?.largura).toBe(LARGURA_MAXIMA);
  });

  it("visibilidade: a escolha da pessoa vence o padrão, e a fixa nunca some", () => {
    const r = resolverColunas(DEFINICOES, {
      visiveis: { descricao: true, prazo: false, titulo: false },
    });
    expect(r.find((c) => c.id === "descricao")?.visivel).toBe(true);
    expect(r.find((c) => c.id === "prazo")?.visivel).toBe(false);
    expect(r.find((c) => c.id === "titulo")?.visivel).toBe(true);
  });
});

describe("moverColuna", () => {
  const ordem = ["status", "prioridade", "prazo", "descricao"];

  it("leva a coluna para a posição da que ela encontrou (para os dois lados)", () => {
    expect(moverColuna(ordem, "status", "prazo")).toEqual([
      "prioridade",
      "prazo",
      "status",
      "descricao",
    ]);
    expect(moverColuna(ordem, "descricao", "status")).toEqual([
      "descricao",
      "status",
      "prioridade",
      "prazo",
    ]);
  });

  it("id desconhecido ou o mesmo id: não muda nada, e não altera a lista original", () => {
    expect(moverColuna(ordem, "x", "prazo")).toEqual(ordem);
    expect(moverColuna(ordem, "prazo", "prazo")).toEqual(ordem);
    expect(ordem).toEqual(["status", "prioridade", "prazo", "descricao"]);
  });
});

describe("limitarLargura e o schema da preferência", () => {
  it("arredonda e prende nos limites; lixo vira o mínimo", () => {
    expect(limitarLargura(150.6)).toBe(151);
    expect(limitarLargura(-10)).toBe(LARGURA_MINIMA);
    expect(limitarLargura(99999)).toBe(LARGURA_MAXIMA);
    expect(limitarLargura(Number.NaN)).toBe(LARGURA_MINIMA);
  });

  it("aceita a forma esperada e recusa chave desconhecida e largura fora do limite", () => {
    expect(
      preferenciasDaTabelaSchema.safeParse({
        ordem: ["a", "b"],
        larguras: { a: 120 },
        visiveis: { a: false },
      }).success,
    ).toBe(true);
    expect(preferenciasDaTabelaSchema.safeParse({}).success).toBe(true);
    expect(preferenciasDaTabelaSchema.safeParse({ outra: 1 }).success).toBe(false);
    expect(preferenciasDaTabelaSchema.safeParse({ larguras: { a: 10 } }).success).toBe(false);
    expect(preferenciasDaTabelaSchema.safeParse({ larguras: { a: 5000 } }).success).toBe(false);
  });
});

describe("ordem manual das linhas", () => {
  it("a posição entre duas vizinhas é o ponto médio; nas pontas, passo de 1", () => {
    expect(posicaoEntre(10, 20)).toBe(15);
    expect(posicaoEntre(undefined, 20)).toBe(19);
    expect(posicaoEntre(10, undefined)).toBe(11);
    expect(posicaoEntre(undefined, undefined)).toBe(1);
  });

  it("detecta quando as vizinhas ficaram coladas demais e renumera a partir da menor", () => {
    expect(lacunaAcabou(1_800_000_000, 1_800_000_000.00001)).toBe(true);
    expect(lacunaAcabou(1, 2)).toBe(false);
    expect(lacunaAcabou(undefined, 2)).toBe(false);
    expect(renumerar([100, 100.00001, 100.00002])).toEqual([100, 101, 102]);
  });

  it("depois de ~20 meios seguidos entre as mesmas vizinhas, a conta ainda separa — ou avisa", () => {
    let a = 1_800_000_000;
    const b = a + 1;
    let avisou = false;
    for (let i = 0; i < 40; i++) {
      if (lacunaAcabou(a, b)) {
        avisou = true;
        break;
      }
      a = posicaoEntre(a, b);
      expect(a).toBeGreaterThan(1_800_000_000 - 1);
    }
    expect(avisou).toBe(true);
  });

  it("move um item na lista para o índice pedido, sem mexer na original", () => {
    const lista = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const nova = moverNaLista(lista, (x) => x.id, "a", 2);
    expect(nova.map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(lista.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("data e hora do campo, no fuso da organização", () => {
  const SP = "America/Sao_Paulo";

  it("ida e volta: o texto do input vira o instante certo e volta igual", () => {
    // 14:30 em São Paulo (UTC-3) = 17:30Z.
    const iso = deCampoLocal("2026-10-08T14:30", SP);
    expect(iso).toBe("2026-10-08T17:30:00.000Z");
    expect(paraCampoLocal(iso, SP)).toBe("2026-10-08T14:30");
  });

  it("a hora é a do relógio da empresa, não a do navegador", () => {
    expect(deCampoLocal("2026-10-08T14:30", "Asia/Tokyo")).toBe("2026-10-08T05:30:00.000Z");
    expect(deCampoLocal("2026-10-08T14:30", "UTC")).toBe("2026-10-08T14:30:00.000Z");
  });

  it("texto que não é uma data/hora vira null, e vazio vira vazio", () => {
    expect(deCampoLocal("", SP)).toBeNull();
    expect(deCampoLocal("amanhã", SP)).toBeNull();
    expect(paraCampoLocal(null, SP)).toBe("");
  });

  it("o rótulo omite a hora quando é meia-noite exata e o ano quando é o corrente", () => {
    const agora = new Date("2026-10-07T12:00:00Z");
    const semHora = rotuloDaData("2026-10-08T03:00:00.000Z", SP, "pt-BR", agora);
    const comHora = rotuloDaData("2026-10-08T17:30:00.000Z", SP, "pt-BR", agora);
    expect(semHora).not.toMatch(/\d{2}:\d{2}/);
    expect(comHora).toMatch(/14:30/);
    expect(comHora).not.toMatch(/2026/);
    expect(rotuloDaData("2027-01-10T17:30:00.000Z", SP, "pt-BR", agora)).toMatch(/2027/);
  });
});
