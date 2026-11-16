import { describe, expect, it } from "vitest";

import {
  baseDoCronograma,
  diferencaEmDias,
  mesesDoEixo,
  nomeDoMes,
  periodoDoItem,
  semanasDepoisDoArrasto,
  semanasDoEixo,
} from "./cronograma-linha-do-tempo";

describe("linha do tempo do cronograma", () => {
  it("a base é o domingo da data de início (ou da semana de hoje)", () => {
    expect(baseDoCronograma("2026-11-18", "2026-11-16")).toBe("2026-11-15"); // quarta → domingo
    expect(baseDoCronograma(null, "2026-11-18")).toBe("2026-11-15");
  });

  it("uma ação ocupa os dias das semanas dela", () => {
    expect(periodoDoItem("2026-11-15", 1, 1)).toEqual({ inicio: "2026-11-15", fim: "2026-11-21" });
    expect(periodoDoItem("2026-11-15", 2, 3)).toEqual({ inicio: "2026-11-22", fim: "2026-12-05" });
  });

  it("arrastar anda de semana em semana, sem sair do limite", () => {
    const item = { semana_inicio: 3, semana_fim: 4 };
    expect(semanasDepoisDoArrasto(item, "mover", 14)).toEqual({ semana_inicio: 5, semana_fim: 6 });
    expect(semanasDepoisDoArrasto(item, "mover", 3)).toEqual(item); // menos de meia semana
    expect(semanasDepoisDoArrasto(item, "mover", -70)).toEqual({ semana_inicio: 1, semana_fim: 2 });
    expect(semanasDepoisDoArrasto(item, "fim", 7)).toEqual({ semana_inicio: 3, semana_fim: 5 });
    expect(semanasDepoisDoArrasto(item, "fim", -70)).toEqual({ semana_inicio: 3, semana_fim: 3 });
    expect(semanasDepoisDoArrasto(item, "inicio", -7)).toEqual({ semana_inicio: 2, semana_fim: 4 });
    expect(semanasDepoisDoArrasto(item, "inicio", 70)).toEqual({ semana_inicio: 4, semana_fim: 4 });
  });

  it("não passa da semana 520 ao mover", () => {
    expect(semanasDepoisDoArrasto({ semana_inicio: 519, semana_fim: 520 }, "mover", 70)).toEqual({
      semana_inicio: 519,
      semana_fim: 520,
    });
  });

  it("meses e semanas do eixo", () => {
    expect(mesesDoEixo("2026-11-28", 8)).toEqual([
      { chave: "2026-11", dias: 3 },
      { chave: "2026-12", dias: 5 },
    ]);
    expect(nomeDoMes("2026-11")).toBe("novembro 2026");
    const s = semanasDoEixo("2026-11-10", 21, "2026-11-15");
    expect(s.map((x) => [x.domingo, x.numero])).toEqual([
      ["2026-11-15", 1],
      ["2026-11-22", 2],
      ["2026-11-29", 3],
    ]);
    expect(semanasDoEixo("2026-11-01", 8, "2026-11-15")[0]).toEqual({
      domingo: "2026-11-01",
      numero: null,
    });
    expect(diferencaEmDias("2026-11-01", "2026-11-05")).toBe(4);
  });
});
