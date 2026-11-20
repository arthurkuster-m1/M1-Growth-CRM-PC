import { describe, expect, it } from "vitest";

import {
  centavosDoTexto,
  linhaDoPerfil,
  perfilDaLinha,
  perfilParaDiagnostico,
  perfilSchema,
} from "./perfil";

const base = { nicho: "clinica", modelos: ["agendamento", "whatsapp"], jaTemOferta: true };

describe("perfilSchema", () => {
  it("aceita o mínimo e preenche o resto com 'sem valor'", () => {
    const r = perfilSchema.parse({ nicho: "loja", modelos: [] });
    expect(r).toMatchObject({
      nicho: "loja",
      modelos: [],
      jaTemOferta: false,
      objetivo: null,
      ticketMedioCents: null,
      metaLeadsMes: null,
      siteUrl: null,
    });
  });

  it("modelo repetido some; link vazio vira nulo", () => {
    const r = perfilSchema.parse({ ...base, modelos: ["whatsapp", "whatsapp"], siteUrl: "  " });
    expect(r.modelos).toEqual(["whatsapp"]);
    expect(r.siteUrl).toBeNull();
  });

  it("recusa nicho, modelo, objetivo e link que não existem", () => {
    expect(perfilSchema.safeParse({ ...base, nicho: "advocacia" }).success).toBe(false);
    expect(perfilSchema.safeParse({ ...base, modelos: ["telepatia"] }).success).toBe(false);
    expect(perfilSchema.safeParse({ ...base, objetivo: "ficar_rico" }).success).toBe(false);
    expect(perfilSchema.safeParse({ ...base, siteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(perfilSchema.safeParse({ ...base, siteUrl: "meusite.com.br" }).success).toBe(false);
  });

  it("recusa número negativo", () => {
    expect(perfilSchema.safeParse({ ...base, ticketMedioCents: -1 }).success).toBe(false);
    expect(perfilSchema.safeParse({ ...base, metaLeadsMes: -5 }).success).toBe(false);
  });
});

describe("conversões", () => {
  it("ida e volta pela linha do banco não perde nada", () => {
    const entrada = perfilSchema.parse({
      ...base,
      objetivo: "mais_vendas",
      ticketMedioCents: 35000,
      metaLeadsMes: 120,
      siteUrl: "https://exemplo.com.br",
    });
    expect(perfilDaLinha(linhaDoPerfil(entrada))).toEqual(entrada);
  });

  it("o perfil do diagnóstico conta os canais online informados", () => {
    const p = perfilDaLinha({
      nicho: "loja",
      modelos: [],
      site_url: "https://a.com",
      instagram_url: "https://b.com",
    });
    expect(perfilParaDiagnostico(p).canaisOnline).toBe(2);
  });
});

describe("centavosDoTexto", () => {
  it("lê reais com vírgula e ponto de milhar", () => {
    expect(centavosDoTexto("350")).toBe(35000);
    expect(centavosDoTexto("1.250,50")).toBe(125050);
    expect(centavosDoTexto(" 0 ")).toBe(0);
  });

  it("vazio é 'sem valor'; ilegível e negativo são recusados", () => {
    expect(centavosDoTexto("")).toBeNull();
    expect(centavosDoTexto("abc")).toBeUndefined();
    expect(centavosDoTexto("-5")).toBeUndefined();
  });
});
