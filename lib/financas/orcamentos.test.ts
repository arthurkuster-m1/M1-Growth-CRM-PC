import { describe, expect, it } from "vitest";
import type { Categoria } from "./tipos";
import {
  anualEfetivo,
  categoriasDoAno,
  mensalEfetivo,
  orcamentoDe,
  permitidoNoMes,
  primeiroAno,
  soAnual,
  type OrcamentoAno,
} from "./orcamentos";

const o = (
  category_id: string,
  ano: number,
  mensal_cents: number,
  anual_cents: number,
): OrcamentoAno => ({ category_id, ano, mensal_cents, anual_cents });
const rows = [o("a", 2026, 100_00, 1200_00), o("b", 2026, 0, 500_00), o("a", 2028, 200_00, 0)];

describe("orçamentos por ano", () => {
  it("o primeiro ano com registro é o início; antes dele não há orçamento", () => {
    expect(primeiroAno(rows)).toBe(2026);
    expect(orcamentoDe(rows, "a", 2025)).toMatchObject({ mensal: 0, anual: 0, aplicavel: false });
  });
  it("ano com registro usa o dele", () => {
    expect(orcamentoDe(rows, "a", 2026)).toEqual({
      mensal: 100_00,
      anual: 1200_00,
      herdadoDe: null,
      aplicavel: true,
    });
  });
  it("ano sem registro herda o último anterior (e diz de onde)", () => {
    expect(orcamentoDe(rows, "a", 2027)).toMatchObject({ mensal: 100_00, herdadoDe: 2026 });
    expect(orcamentoDe(rows, "a", 2029)).toMatchObject({
      mensal: 200_00,
      anual: 0,
      herdadoDe: 2028,
    });
  });
  it("registro do ano manda mesmo que seja zero", () => {
    expect(orcamentoDe([...rows, o("a", 2027, 0, 0)], "a", 2027)).toMatchObject({
      mensal: 0,
      anual: 0,
      herdadoDe: null,
    });
  });
  it("categoria sem nenhum registro fica sem orçamento", () => {
    expect(orcamentoDe(rows, "z", 2027)).toMatchObject({ mensal: 0, anual: 0, aplicavel: true });
  });
  it("categoriasDoAno troca só os valores de orçamento", () => {
    const cats = [
      { id: "a", nome: "A", orcamento_mensal_cents: 1, orcamento_anual_cents: 1 } as Categoria,
    ];
    expect(categoriasDoAno(cats, rows, 2028)[0]).toMatchObject({
      nome: "A",
      orcamento_mensal_cents: 200_00,
      orcamento_anual_cents: 0,
    });
    expect(categoriasDoAno(cats, rows, 2024)[0]).toMatchObject({
      orcamento_mensal_cents: 0,
      orcamento_anual_cents: 0,
    });
  });
  it("referências: mensal ou anual÷12; anual ou mensal×12", () => {
    expect(mensalEfetivo({ orcamento_mensal_cents: 0, orcamento_anual_cents: 1200_00 })).toBe(
      100_00,
    );
    expect(mensalEfetivo({ orcamento_mensal_cents: 50_00, orcamento_anual_cents: 1200_00 })).toBe(
      50_00,
    );
    expect(anualEfetivo({ orcamento_mensal_cents: 50_00, orcamento_anual_cents: 0 })).toBe(600_00);
    expect(soAnual({ orcamento_mensal_cents: 0, orcamento_anual_cents: 1 })).toBe(true);
    expect(soAnual({ orcamento_mensal_cents: 1, orcamento_anual_cents: 1 })).toBe(false);
  });
  it("só-anual é flexível: o que sobra do ano dividido pelos meses que faltam", () => {
    expect(permitidoNoMes(1200_00, 0, 12)).toBe(100_00);
    expect(permitidoNoMes(1200_00, 600_00, 6)).toBe(100_00); // gastou metade no 1º semestre: 100/mês
    expect(permitidoNoMes(1200_00, 900_00, 11)).toBe(Math.round(300_00 / 11)); // estourou o mês 1: os próximos ficam menores
    expect(permitidoNoMes(500_00, 900_00, 11)).toBe(0); // ano já estourado
  });
});
