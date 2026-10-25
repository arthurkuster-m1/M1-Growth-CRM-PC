/**
 * A grade no CELULAR segue o Google Agenda: Dia (1 coluna), 3 dias (3 colunas), Semana (7
 * colunas estreitas) e Mês. Nada é escondido por classe — o que muda é quantas colunas existem.
 *
 * O teste não mede pixel (jsdom não faz layout): prova a REGRA — quais colunas existem para cada
 * visão e que nenhuma carrega a classe que a escondia abaixo de `md`. A prova visual real é a
 * spec de Playwright em 360px.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GradeDaAgenda } from "./GradeDaAgenda";
import type { VisaoDaAgenda } from "./tipos";

const QUARTA = new Date("2026-09-16T12:00:00-03:00");

function grade(visao: VisaoDaAgenda) {
  return render(
    <GradeDaAgenda
      visao={visao}
      ancora={QUARTA}
      agora={QUARTA}
      fuso={Intl.DateTimeFormat().resolvedOptions().timeZone}
      agendamentos={[]}
      pessoas={[]}
    />,
  );
}

const colunas = () => screen.getAllByTestId(/^coluna-dia-/).map((c) => c.dataset.testid);

describe("grade no celular e no computador", () => {
  it("a semana tem as sete colunas, de domingo a sábado, e nenhuma some no celular", () => {
    grade("semana");
    expect(colunas()).toEqual([13, 14, 15, 16, 17, 18, 19].map((d) => `coluna-dia-2026-09-${d}`));
    for (const c of screen.getAllByTestId(/^coluna-dia-/)) {
      expect(c.className, "esconder por classe é o que a visão do Google não faz").not.toContain(
        "max-md:hidden",
      );
    }
  });

  it("3 dias começa no dia da âncora e tem exatamente três colunas", () => {
    grade("tres_dias");
    expect(colunas()).toEqual([
      "coluna-dia-2026-09-16",
      "coluna-dia-2026-09-17",
      "coluna-dia-2026-09-18",
    ]);
    expect(screen.getByTestId("grade-da-agenda").dataset.visao).toBe("tres_dias");
  });

  it("o dia tem uma coluna só", () => {
    grade("dia");
    expect(colunas()).toEqual(["coluna-dia-2026-09-16"]);
  });
});
