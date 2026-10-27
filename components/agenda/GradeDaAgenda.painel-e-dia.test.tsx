/**
 * Semana e 3 dias ganham o painel do dia embaixo (como o mês); a visão Dia não tem painel: só o
 * seletor de propriedades, e a hora cresce para o bloco caber com elas sem empilhar.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GradeDaAgenda, alturaDaHoraParaPropriedades } from "./GradeDaAgenda";
import type { Agendamento, VisaoDaAgenda } from "./tipos";

const FUSO = "America/Sao_Paulo";
const QUARTA = new Date("2026-09-16T15:00:00Z"); // 12:00 em São Paulo

const reuniao: Agendamento = {
  id: "r1",
  titulo: "Reunião",
  responsavelId: "u1",
  comeca: "2026-09-17T12:00:00Z", // quinta 09:00
  termina: "2026-09-17T12:30:00Z",
  origem: "ui",
  situacao: "confirmed",
  quemSeraAtendido: "Ana Souza",
};

function grade(visao: VisaoDaAgenda) {
  return render(
    <GradeDaAgenda
      visao={visao}
      ancora={QUARTA}
      agora={QUARTA}
      fuso={FUSO}
      agendamentos={[reuniao]}
      pessoas={[]}
    />,
  );
}

describe("painel do dia na semana e nos 3 dias", () => {
  it.each(["semana", "tres_dias"] as const)(
    "%s: o cabeçalho do dia abre o painel dele",
    (visao) => {
      grade(visao);
      fireEvent.click(screen.getByTestId("cabecalho-dia-2026-09-17"));
      const painel = screen.getByTestId("painel-do-dia");
      expect(painel.dataset.dia).toBe("2026-09-17");
      expect(painel.textContent).toContain("Reunião");
    },
  );

  it("sem escolher, o painel abre no dia de hoje", () => {
    grade("semana");
    expect(screen.getByTestId("painel-do-dia").dataset.dia).toBe("2026-09-16");
  });

  it("a visão Dia não tem painel embaixo: só o seletor de propriedades", () => {
    grade("dia");
    expect(screen.queryByTestId("painel-do-dia")).toBeNull();
    expect(screen.getByTestId("escolher-propriedades")).toBeTruthy();
  });
});

describe("altura da hora na visão Dia", () => {
  it("sem propriedades escolhidas, a hora tem a altura de fábrica", () => {
    expect(alturaDaHoraParaPropriedades([reuniao], 0)).toBe(48);
  });

  it("com propriedades, a hora cresce até o compromisso mais curto caber", () => {
    const poucas = alturaDaHoraParaPropriedades([reuniao], 2);
    const muitas = alturaDaHoraParaPropriedades([reuniao], 6);
    expect(poucas).toBeGreaterThan(48);
    expect(muitas).toBeGreaterThan(poucas);
    // 30 min = meia hora: o bloco precisa de (34 + 6×22) px, então a hora vale o dobro disso.
    expect(muitas).toBe((34 + 6 * 22) * 2);
  });

  it("a ocupação do Google não pede espaço", () => {
    const google: Agendamento = { ...reuniao, id: "g", origem: "google_sync", titulo: "Ocupado" };
    expect(alturaDaHoraParaPropriedades([google], 6)).toBe(48);
  });
});

describe("ocupação fora da janela da grade", () => {
  it("a ocupação das 05:40 (antes das 07h) não é desenhada em cima do cabeçalho do dia", () => {
    const madrugada: Agendamento = {
      id: "g-madrugada",
      titulo: "Ocupado",
      responsavelId: "u1",
      comeca: "2026-09-17T08:40:00Z", // 05:40 em São Paulo
      termina: "2026-09-17T09:10:00Z",
      origem: "google_sync",
      situacao: "confirmed",
    };
    render(
      <GradeDaAgenda
        visao="tres_dias"
        ancora={QUARTA}
        agora={QUARTA}
        fuso={FUSO}
        agendamentos={[madrugada, reuniao]}
        pessoas={[]}
      />,
    );
    expect(screen.queryByTestId("agendamento-g-madrugada")).toBeNull();
    expect(screen.getByTestId("agendamento-r1")).toBeTruthy();
  });
});
