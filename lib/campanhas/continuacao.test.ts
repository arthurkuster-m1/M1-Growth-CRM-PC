// @vitest-environment node
import { describe, expect, it } from "vitest";

import { PASSO_NOVO_DO_FLUXO } from "@/lib/cadencia/fluxo-da-abordagem";

import { montarPedidoDaContinuacao, prazoDaEspera, proximoPasso } from "./continuacao";

const msg = PASSO_NOVO_DO_FLUXO("mensagem");
const espera = PASSO_NOVO_DO_FLUXO("aguardar");
const audio = PASSO_NOVO_DO_FLUXO("audio");
const enc = PASSO_NOVO_DO_FLUXO("encaminhar");

describe("proximoPasso", () => {
  it("devolve fim quando não há mais passos", () => {
    expect(proximoPasso([msg], 1)).toEqual({ tipo: "fim" });
    expect(proximoPasso([], 0)).toEqual({ tipo: "fim" });
  });

  it("para na espera com o prazo do passo", () => {
    expect(proximoPasso([msg, espera], 1)).toEqual({ tipo: "aguardar", indice: 1, horas: 48 });
  });

  it("separa mensagem, áudio e encaminhar", () => {
    const passos = [msg, espera, msg, audio, enc];
    expect(proximoPasso(passos, 2).tipo).toBe("mensagem");
    expect(proximoPasso(passos, 3).tipo).toBe("audio");
    expect(proximoPasso(passos, 4)).toEqual({ tipo: "encaminhar", indice: 4 });
  });
});

describe("prazoDaEspera", () => {
  const agora = new Date("2026-10-25T12:00:00Z");
  it("soma as horas", () => {
    expect(prazoDaEspera(48, agora)?.toISOString()).toBe("2026-10-27T12:00:00.000Z");
  });
  it("sem prazo, não vence", () => {
    expect(prazoDaEspera(null, agora)).toBeNull();
  });
});

describe("montarPedidoDaContinuacao", () => {
  it("leva a abertura, a ideia central e só as 3 últimas respostas", () => {
    const pedido = montarPedidoDaContinuacao({
      ideiaCentral: "agenda cheia",
      instrucao: "",
      nomeDaAbordagem: "Cold",
      nomeDoLead: "Ana",
      abertura: "Oi Ana!",
      respostasDoLead: ["a", "b", "c", "d"],
    });
    expect(pedido).toContain("agenda cheia");
    expect(pedido).toContain("Oi Ana!");
    expect(pedido).not.toContain("- a\n");
    expect(pedido).toContain("- d");
  });
});
