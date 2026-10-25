import { describe, expect, it } from "vitest";

import {
  PASSO_NOVO_DO_FLUXO,
  avisosDoFluxo,
  continuarAposResposta,
  fluxoDaAbordagemSchema,
  simularConversa,
  type PassoDoFluxo,
} from "./fluxo-da-abordagem";

const msg = (body: string): PassoDoFluxo => ({ ...PASSO_NOVO_DO_FLUXO("mensagem"), body });
const ctx = {
  nomeDoLead: "Ana Souza",
  ideiaCentral: "agenda cheia por causa de clientes que faltam",
};

describe("simularConversa", () => {
  it("manda a primeira mensagem, para ao aguardar e segue quando o lead responde", () => {
    const passos = [
      msg("Olá {{primeiro_nome}}, bom dia!"),
      PASSO_NOVO_DO_FLUXO("aguardar"),
      msg("Que bom! Posso te explicar em 1 minuto?"),
      { ...PASSO_NOVO_DO_FLUXO("audio"), audio_label: "Apresentação" },
      PASSO_NOVO_DO_FLUXO("encaminhar"),
    ];
    const a = simularConversa(passos, ctx);
    expect(a.esperandoEm).toBe(1);
    expect(a.terminou).toBe(false);
    expect(a.bolhas.map((b) => b.texto)).toEqual([
      "Olá Ana, bom dia!",
      "⏳ Aguardando a resposta (até 48 h)",
    ]);
    const b = continuarAposResposta(passos, ctx, a);
    expect(b.terminou).toBe(true);
    expect(b.bolhas.map((x) => x.de)).toEqual(["nos", "sistema", "lead", "nos", "nos", "sistema"]);
    expect(b.bolhas.at(-1)!.texto).toContain("atendente");
  });

  it("mensagem da IA é descrita com a ideia central, não escrita", () => {
    const e = simularConversa([{ ...PASSO_NOVO_DO_FLUXO("mensagem"), ai_personalize: true }], ctx);
    expect(e.bolhas[0]!.texto).toContain("A IA escreve para Ana Souza");
    expect(e.bolhas[0]!.texto).toContain("agenda cheia");
  });

  it("depois do fim, continuar não muda nada", () => {
    const e = simularConversa([msg("Oi")], ctx);
    expect(continuarAposResposta([msg("Oi")], ctx, e)).toBe(e);
  });
});

describe("avisosDoFluxo", () => {
  it("avisa de mensagem vazia, áudio sem nome, IA sem ideia, esperas seguidas e fim esperando", () => {
    const av = avisosDoFluxo(
      [
        PASSO_NOVO_DO_FLUXO("mensagem"),
        PASSO_NOVO_DO_FLUXO("audio"),
        { ...PASSO_NOVO_DO_FLUXO("mensagem"), ai_personalize: true },
        PASSO_NOVO_DO_FLUXO("aguardar"),
        PASSO_NOVO_DO_FLUXO("aguardar"),
      ],
      "",
    );
    expect(av.join("|")).toMatch(/Passo 1: escreva/);
    expect(av.join("|")).toMatch(/Passo 2: escolha ou envie o arquivo do áudio/);
    expect(av.join("|")).toMatch(/ideia central/);
    expect(av.join("|")).toMatch(/duas esperas seguidas/);
    expect(av.join("|")).toMatch(/termina esperando/);
  });

  it("fluxo completo e vazio não têm aviso", () => {
    expect(avisosDoFluxo([], "")).toEqual([]);
    expect(
      avisosDoFluxo([msg("Oi"), PASSO_NOVO_DO_FLUXO("aguardar"), msg("Tudo bem?")], ""),
    ).toEqual([]);
  });
});

describe("fluxoDaAbordagemSchema", () => {
  it("aceita até 12 passos e recusa tipo desconhecido e espera fora da faixa", () => {
    expect(fluxoDaAbordagemSchema.safeParse({ steps: [msg("Oi")] }).success).toBe(true);
    expect(
      fluxoDaAbordagemSchema.safeParse({ steps: Array.from({ length: 13 }, () => msg("x")) })
        .success,
    ).toBe(false);
    expect(
      fluxoDaAbordagemSchema.safeParse({ steps: [{ ...msg("x"), kind: "pombo" }] }).success,
    ).toBe(false);
    expect(
      fluxoDaAbordagemSchema.safeParse({
        steps: [{ ...PASSO_NOVO_DO_FLUXO("aguardar"), wait_hours: 0 }],
      }).success,
    ).toBe(false);
  });
});
