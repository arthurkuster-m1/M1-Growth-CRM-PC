/**
 * O FIM DO ONBOARDING NÃO AFIRMA O QUE NÃO ENTREGOU.
 *
 * A última página antiga dizia "Seu funcionário já está de pé" para quem tinha pulado a IA. O onboarding novo
 * (Seu negócio e Sua equipe) não fala de funcionário nem de IA: só resume o que foi feito e diz o que ficou
 * para depois, sem prometer nada que o sistema não entregue.
 */
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DoneClient } from "@/app/onboarding/done/_client";
import type { ItemDoResumo } from "@/lib/onboarding/passos";

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (texto: string) => texto }));
vi.mock("@/app/actions/onboarding/finishOnboarding", () => ({
  finishOnboarding: vi.fn(async () => ({ ok: true })),
}));

const feito = (segmento: string, rotulo: string): ItemDoResumo => ({
  segmento,
  rotulo,
  feito: true,
  pulado: false,
});

function tela(itens: ItemDoResumo[]): string {
  render(<DoneClient itens={itens} />);
  return document.body.textContent ?? "";
}

describe("a última página do onboarding novo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não promete funcionário, IA nem atendimento no ar", () => {
    const texto = tela([feito("welcome", "Seu negócio"), feito("invite-team", "Sua equipe")]);
    expect(texto).not.toContain("funcionário");
    expect(texto).not.toContain("de pé");
    expect(texto).not.toMatch(/\bIA\b/);
  });

  it("mostra o que foi feito e o que foi pulado", () => {
    const texto = tela([
      feito("welcome", "Seu negócio"),
      { segmento: "invite-team", rotulo: "Sua equipe", feito: false, pulado: true },
    ]);
    expect(texto).toContain("Seu negócio");
    expect(texto).toContain("Sua equipe (você pulou)");
  });

  it("apresenta as quatro telas do dia a dia", () => {
    const texto = tela([feito("welcome", "Seu negócio")]);
    for (const t of ["Início", "Clientes (CRM)", "Agenda", "Tarefas"]) expect(texto).toContain(t);
  });
});
