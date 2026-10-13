import { describe, expect, it } from "vitest";

import { janelaDaBase, pedacosDaJanela } from "./meta-por-anuncio-servidor";

describe("pedacosDaJanela", () => {
  it("corta em pedaços de até 7 dias, sem buraco nem sobreposição", () => {
    expect(pedacosDaJanela("2026-10-01", "2026-10-16")).toEqual([
      { de: "2026-10-01", ate: "2026-10-07" },
      { de: "2026-10-08", ate: "2026-10-14" },
      { de: "2026-10-15", ate: "2026-10-16" },
    ]);
  });
  it("um dia só vira um pedaço", () => {
    expect(pedacosDaJanela("2026-10-05", "2026-10-05")).toEqual([
      { de: "2026-10-05", ate: "2026-10-05" },
    ]);
  });
});

describe("janelaDaBase", () => {
  const c = { start_date: "2026-09-01", end_date: null };
  const as = (h: number) => new Date(`2026-10-13T${String(h).padStart(2, "0")}:17:00Z`);

  it("sem nenhum dado: primeira carga do início da campanha até hoje", () => {
    expect(janelaDaBase(c, as(14), false, false)).toEqual({
      modo: "primeira_carga",
      de: "2026-09-01",
      ate: "2026-10-13",
    });
  });
  it("a primeira carga nunca passa de 90 dias", () => {
    const r = janelaDaBase({ start_date: "2025-01-01", end_date: null }, as(14), false, false);
    expect(r?.de).toBe("2026-07-15");
  });
  it("com dados: só relê de 6 em 6 horas (os últimos 7 dias)", () => {
    expect(janelaDaBase(c, as(14), true, false)).toBeNull();
    expect(janelaDaBase(c, as(12), true, false)).toEqual({
      modo: "recente",
      de: "2026-10-07",
      ate: "2026-10-13",
    });
  });
  it("de madrugada relê os últimos 28 dias", () => {
    expect(janelaDaBase(c, as(6), true, false)).toEqual({
      modo: "profundo",
      de: "2026-09-16",
      ate: "2026-10-13",
    });
  });
  it("o botão manual sempre relê os últimos 7 dias", () => {
    expect(janelaDaBase(c, as(14), true, true)?.modo).toBe("recente");
  });
  it("campanha encerrada há pouco relê até o último dia dela; encerrada há muito não relê", () => {
    const recente = janelaDaBase(
      { start_date: "2026-09-01", end_date: "2026-10-10" },
      as(12),
      true,
      false,
    );
    expect(recente?.ate).toBe("2026-10-10");
    expect(
      janelaDaBase({ start_date: "2026-09-01", end_date: "2026-09-30" }, as(12), true, false),
    ).toBeNull();
  });
});
