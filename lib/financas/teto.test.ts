import { describe, expect, it } from "vitest";
import { tetoDoAno, tetoDoMes } from "./teto";

describe("teto do mês", () => {
  const p = { tetoPadrao: 8000_00, tetos: { "2026-12": 12000_00, "2026-03": 0 } };
  it("o mês pode ter o seu valor; senão vale o padrão", () => {
    expect(tetoDoMes(p, "2026-12")).toEqual({ valor: 12000_00, origem: "mes" });
    expect(tetoDoMes(p, "2026-11")).toEqual({ valor: 8000_00, origem: "padrao" });
    expect(tetoDoMes(p, "2026-03")).toEqual({ valor: 0, origem: "mes" }); // zero escolhido para o mês vale como escolha
  });
  it("sem padrão nem exceção: não definido", () =>
    expect(tetoDoMes({ tetoPadrao: 0, tetos: {} }, "2026-01")).toEqual({
      valor: 0,
      origem: "nenhum",
    }));
  it("teto do ano = soma dos 12 meses", () =>
    expect(tetoDoAno(p, 2026)).toBe(10 * 8000_00 + 12000_00 + 0));
});
