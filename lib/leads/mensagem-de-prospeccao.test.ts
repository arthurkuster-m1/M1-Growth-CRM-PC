import { describe, expect, it } from "vitest";

import { aplicarVariaveis, linkDoWhatsapp, melhorFaixa } from "./mensagem-de-prospeccao";

describe("mensagem de prospecção", () => {
  it("troca as variáveis nos dois formatos e mantém as desconhecidas", () => {
    const txt = aplicarVariaveis("Olá {primeiro_nome}! {{produto}} em {campanha}. {x}", {
      nome: "Maria Souza",
      produto: "Assessoria",
      campanha: "Outubro",
    });
    expect(txt).toBe("Olá Maria! Assessoria em Outubro. {x}");
  });
  it("monta o link do WhatsApp", () => {
    expect(linkDoWhatsapp("+55 11 98888-7777", "Oi, tudo bem?")).toBe(
      "https://wa.me/5511988887777?text=Oi%2C%20tudo%20bem%3F",
    );
    expect(linkDoWhatsapp("", "x")).toBeNull();
  });
  it("sugere a faixa só com sinais suficientes", () => {
    expect(melhorFaixa([14, 15])).toBeNull();
    expect(melhorFaixa([14, 15, 15, 9])).toEqual({ faixa: "14h–16h", base: 4 });
  });
});
