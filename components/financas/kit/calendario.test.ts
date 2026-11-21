import { describe, expect, it } from "vitest";
import {
  brParaISO,
  diasDoCalendario,
  isoParaBR,
  mascaraData,
  somarDias,
  somarMeses,
  tituloDoMes,
} from "./calendario";

describe("data em português", () => {
  it("ISO ⇄ BR", () => {
    expect(isoParaBR("2026-10-05")).toBe("05/10/2026");
    expect(isoParaBR("")).toBe("");
    expect(brParaISO("05/10/2026")).toBe("2026-10-05");
    expect(brParaISO("2026-10-05")).toBe("2026-10-05");
  });
  it.each(["31/02/2026", "32/01/2026", "00/10/2026", "05/10/26", "abc", ""])(
    "data impossível %j → null",
    (t) => expect(brParaISO(t)).toBeNull(),
  );
  it("ano bissexto", () => {
    expect(brParaISO("29/02/2028")).toBe("2028-02-29");
    expect(brParaISO("29/02/2026")).toBeNull();
  });
  it.each([
    ["05", "05"],
    ["051", "05/1"],
    ["0510", "05/10"],
    ["05102026", "05/10/2026"],
    ["05/10/2026", "05/10/2026"],
    ["051020269999", "05/10/2026"],
    ["a5b1c0", "51/0"],
  ])("máscara %j → %s", (t, e) => expect(mascaraData(t)).toBe(e));
});

describe("cálculo de dias e meses", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("soma meses sem estourar o dia (31/03 − 1 mês = 28/02)", () => {
    expect(somarMeses("2026-03-31", -1)).toBe("2026-02-28");
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("título em português", () => expect(tituloDoMes(2026, 9)).toBe("Outubro de 2026"));
});

describe("grade do calendário", () => {
  const g = diasDoCalendario(2026, 9); // outubro de 2026 começa numa quinta
  it("tem 6 semanas, começa no domingo e termina no sábado", () => {
    expect(g.length).toBe(42);
    expect(g[0]!.diaSemana).toBe(0);
    expect(g[41]!.diaSemana).toBe(6);
  });
  it("o dia 1 de outubro cai na quinta (coluna 4)", () => {
    const i = g.findIndex((d) => d.iso === "2026-10-01");
    expect(i).toBe(4);
    expect(g[i]!.noMes).toBe(true);
  });
  it("dias de outro mês vêm marcados", () => {
    expect(g[0]!.noMes).toBe(false);
    expect(g[0]!.iso).toBe("2026-09-27");
    expect(g.filter((d) => d.noMes).length).toBe(31);
  });
  it("dezembro vira o ano", () =>
    expect(diasDoCalendario(2026, 11).at(-1)!.iso.startsWith("2027")).toBe(true));
});
