import { describe, expect, it } from "vitest";

import { PASSO_NOVO_DO_FLUXO } from "@/lib/cadencia/fluxo-da-abordagem";

import {
  aberturaEhDaIA,
  extrasDoLead,
  limparMensagemDaIA,
  montarPedidoDaMensagem,
} from "./mensagem-da-ia";

describe("aberturaEhDaIA", () => {
  it("só quando o primeiro passo é mensagem da IA", () => {
    const ia = { ...PASSO_NOVO_DO_FLUXO("mensagem"), ai_personalize: true };
    expect(aberturaEhDaIA([ia])).toBe(true);
    expect(aberturaEhDaIA([PASSO_NOVO_DO_FLUXO("mensagem"), ia])).toBe(false);
    expect(aberturaEhDaIA([PASSO_NOVO_DO_FLUXO("aguardar"), ia])).toBe(false);
    expect(aberturaEhDaIA([])).toBe(false);
    expect(aberturaEhDaIA(null)).toBe(false);
  });
});

describe("montarPedidoDaMensagem", () => {
  it("leva a ideia central, a instrução e os dados do lead — e só isso", () => {
    const p = montarPedidoDaMensagem({
      ideiaCentral: "agenda cheia por causa de faltas",
      instrucao: "mencione o bairro",
      nomeDaAbordagem: "Cold WhatsApp",
      roteiroDeApoio: "",
      lead: { nome: "Clínica Sol", titulo: "Clínica Sol Estética", extras: { cidade: "Santos" } },
    });
    expect(p).toContain("Ideia central: agenda cheia por causa de faltas");
    expect(p).toContain("Instrução para esta mensagem: mencione o bairro");
    expect(p).toContain("Lead: Clínica Sol — Clínica Sol Estética");
    expect(p).toContain("- cidade: Santos");
    expect(p).not.toContain("Roteiro de apoio");
  });
});

describe("limparMensagemDaIA", () => {
  it("tira aspas, cerca de código e negrito; respeita o teto", () => {
    expect(limparMensagemDaIA('"Oi **Ana**, tudo bem?"')).toBe("Oi Ana, tudo bem?");
    expect(limparMensagemDaIA("```\nOi!\n```")).toBe("Oi!");
    expect(limparMensagemDaIA("x".repeat(2000)).length).toBe(1000);
  });
});

describe("extrasDoLead", () => {
  it("só texto curto sem telefone nem e-mail, no máximo 6", () => {
    const e = extrasDoLead({
      cidade: "Santos",
      email: "a@b.com",
      fone: "13999998888",
      n: 4,
      longo: "x".repeat(200),
      a1: "1a",
      a2: "2a",
      a3: "3a",
      a4: "4a",
      a5: "5a",
      a6: "6a",
    });
    expect(e.cidade).toBe("Santos");
    expect(e.email).toBeUndefined();
    expect(e.fone).toBeUndefined();
    expect(e.n).toBeUndefined();
    expect(e.longo).toBeUndefined();
    expect(Object.keys(e)).toHaveLength(6);
  });
});
