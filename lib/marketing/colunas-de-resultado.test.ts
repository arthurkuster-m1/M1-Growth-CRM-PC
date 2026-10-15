import { describe, expect, it } from "vitest";

import {
  AGREGADO_VAZIO,
  COLUNAS_DE_RESULTADO,
  formatarResultado,
  ordemDasColunas,
  somarAgregados,
} from "./colunas-de-resultado";

const col = (id: string) => COLUNAS_DE_RESULTADO.find((c) => c.id === id)!;

describe("colunas de resultado", () => {
  const a = {
    ...AGREGADO_VAZIO,
    impressoes: 10000,
    cliques: 200,
    visitas: 150,
    leads: 30,
    investido: 600,
    agendamentos: 10,
    reunioes: 8,
    vendas: 2,
    faturamento: 3000,
    recebido: 1500,
  };
  it("calcula as taxas e custos", () => {
    expect(col("cpm").valor(a)).toBe(60);
    expect(col("ctr").valor(a)).toBe(2);
    expect(col("cpc").valor(a)).toBe(3);
    expect(col("cpv").valor(a)).toBe(4);
    expect(col("cpl").valor(a)).toBe(20);
    expect(col("conversao_lp").valor(a)).toBe(20);
    expect(col("custo_agendamento").valor(a)).toBe(60);
    expect(col("comparecimento").valor(a)).toBe(80);
    expect(col("cac").valor(a)).toBe(300);
    expect(col("ticket").valor(a)).toBe(1500);
    expect(col("lucro").valor(a)).toBe(900);
    expect(col("roas").valor(a)).toBe(2.5);
  });
  it("sem base, a taxa é vazia (não zero nem infinito)", () => {
    expect(col("cpl").valor(AGREGADO_VAZIO)).toBeNull();
    expect(col("ctr").valor(AGREGADO_VAZIO)).toBeNull();
    expect(formatarResultado("moeda", null)).toBe("—");
  });
  it("o total é a conta sobre a soma, não a soma das taxas", () => {
    const dia1 = { ...AGREGADO_VAZIO, investido: 100, leads: 10 };
    const dia2 = { ...AGREGADO_VAZIO, investido: 300, leads: 10 };
    expect(col("cpl").valor(somarAgregados([dia1, dia2]))).toBe(20);
  });
  it("mantém a ordem salva e põe as novas no fim", () => {
    expect(ordemDasColunas(["b", "x", "a"], ["a", "b", "c"])).toEqual(["b", "a", "c"]);
  });
});
