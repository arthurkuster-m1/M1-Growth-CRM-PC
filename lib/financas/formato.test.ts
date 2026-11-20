import { describe, expect, it } from "vitest";
import { patchPagar } from "./pagar";
import { hoje } from "./formato";
import {
  datasDaFatura,
  dataBR,
  diaNoMes,
  faturaPadrao,
  mesCurto,
  parsePercentual,
  percentualParaCampo,
} from "./formato";
import {
  centavosParaCampo,
  dataCurta,
  digitosParaCentavos,
  intervaloDoMes,
  mesAnterior,
  mesSeguinte,
  mesValido,
  nomeDoMes,
  parseValor,
  calcularExpressao,
} from "./formato";

describe("parseValor", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["12,5", 1250],
    ["R$ 12,50", 1250],
    ["0,99", 99],
    ["13.227,20", 1322720],
    ["1.234", 123400],
    ["45", 4500],
    ["  775,00 ", 77500],
  ])("%s → %i", (txt, esperado) => expect(parseValor(txt)).toBe(esperado));
  it.each([
    ["", null],
    ["abc", null],
    ["-5,00", null],
    ["1,2,3", null],
    ["R$", null],
  ])("%j é inválido", (txt, esperado) => expect(parseValor(txt)).toBe(esperado));
});

describe("campo de valor estilo banco", () => {
  it("digita 4590 → R$ 45,90", () => {
    expect(digitosParaCentavos("4590")).toBe(4590);
    expect(centavosParaCampo(4590)).toBe("45,90");
  });
  it("ignora o que não é dígito e limita o tamanho", () => {
    expect(digitosParaCentavos("45,90")).toBe(4590);
    expect(digitosParaCentavos("1234567890123456")).toBe(123456789012);
  });
  it("zero fica vazio (mostra o placeholder)", () => {
    expect(digitosParaCentavos("")).toBe(0);
    expect(centavosParaCampo(0)).toBe("");
  });
  it("milhar com ponto", () => expect(centavosParaCampo(1322720)).toBe("13.227,20"));
});

describe("meses", () => {
  it("intervalo é [dia 1, dia 1 do mês seguinte)", () =>
    expect(intervaloDoMes("2026-10")).toEqual({ de: "2026-10-01", ate: "2026-11-01" }));
  it("vira o ano", () => {
    expect(mesSeguinte("2026-12")).toBe("2027-01");
    expect(mesAnterior("2027-01")).toBe("2026-12");
    expect(intervaloDoMes("2026-12").ate).toBe("2027-01-01");
  });
  it("valida", () => {
    expect(mesValido("2026-10")).toBe(true);
    expect(mesValido("2026-13")).toBe(false);
    expect(mesValido(null)).toBe(false);
  });
  it("nome em português", () => expect(nomeDoMes("2026-10")).toBe("outubro de 2026"));
  it("data curta", () => expect(dataCurta("2026-10-05")).toBe("05/10"));
});

describe("pagar", () => {
  it("data futura vira hoje (pagou adiantado)", () =>
    expect(patchPagar({ data: "2999-01-01" })).toEqual({ status: "pago", data: hoje() }));
  it("data passada ou de hoje fica como está", () => {
    expect(patchPagar({ data: "2020-01-01" })).toEqual({ status: "pago" });
    expect(patchPagar({ data: hoje() })).toEqual({ status: "pago" });
  });
});

describe("fatura do cartão (paga no mês do vencimento; mesma regra do banco)", () => {
  it("fecha 28, vence 5: compra 28/10 fecha em out e é paga em nov", () =>
    expect(faturaPadrao("2026-10-28", 28, 5)).toBe("2026-11"));
  it("fecha 28, vence 5: compra 31/10 fecha em nov e é paga em DEZ", () =>
    expect(faturaPadrao("2026-10-31", 28, 5)).toBe("2026-12"));
  it("vira o ano", () => expect(faturaPadrao("2026-12-30", 28, 5)).toBe("2027-02"));
  it("fecha 20, vence 27: paga no mesmo mês do fechamento", () => {
    expect(faturaPadrao("2026-10-15", 20, 27)).toBe("2026-10");
    expect(faturaPadrao("2026-10-21", 20, 27)).toBe("2026-11");
  });
  it("vencimento = fechamento conta como mês seguinte", () =>
    expect(faturaPadrao("2026-10-05", 10, 10)).toBe("2026-11"));
  it("sem vencimento cadastrado: vale o mês do fechamento", () => {
    expect(faturaPadrao("2026-10-31", 28, null)).toBe("2026-11");
    expect(faturaPadrao("2026-08-31", null, null)).toBe("2026-08");
  });
  it("nome curto", () => expect(mesCurto("2026-11")).toBe("Nov/26"));
});

describe("rendimento", () => {
  it.each([
    ["120", 120],
    ["120%", 120],
    ["10,5", 10.5],
    ["10.5", 10.5],
    [" 8 % ", 8],
  ])("%j → %d", (t, n) => expect(parsePercentual(t)).toBe(n));
  it.each([
    ["", null],
    ["0", null],
    ["-3", null],
    ["abc", null],
    ["1001", null],
  ])("%j é inválido", (t, n) => expect(parsePercentual(t)).toBe(n));
  it("mostra no campo", () => {
    expect(percentualParaCampo(10.5)).toBe("10,5");
    expect(percentualParaCampo(120)).toBe("120");
    expect(percentualParaCampo(null)).toBe("");
  });
});

describe("datas da fatura (fechamento e pagamento)", () => {
  it("fecha 28, vence 5: fatura de NOVEMBRO fecha em 28/10 e é paga em 05/11 (compras de 29/09 a 28/10)", () =>
    expect(datasDaFatura("2026-11", 28, 5)).toEqual({
      fecha: "2026-10-28",
      paga: "2026-11-05",
      inicio: "2026-09-29",
    }));
  it("fecha 20, vence 27: fecha e paga no mesmo mês", () =>
    expect(datasDaFatura("2026-10", 20, 27)).toEqual({
      fecha: "2026-10-20",
      paga: "2026-10-27",
      inicio: "2026-09-21",
    }));
  it("vencimento = fechamento conta como mês seguinte (mesma regra do app e do banco)", () =>
    expect(datasDaFatura("2026-11", 10, 10)).toEqual({
      fecha: "2026-10-10",
      paga: "2026-11-10",
      inicio: "2026-09-11",
    }));
  it("dia 31 em mês curto cai no último dia (fecha 31 em novembro = 30)", () => {
    expect(diaNoMes("2026-11", 31)).toBe("2026-11-30");
    expect(datasDaFatura("2026-12", 31, 5).fecha).toBe("2026-11-30");
  });
  it("vira o ano", () =>
    expect(datasDaFatura("2027-01", 28, 5)).toEqual({
      fecha: "2026-12-28",
      paga: "2027-01-05",
      inicio: "2026-11-29",
    }));
  it("sem vencimento: só o fechamento (no mês da fatura); sem fechamento: só o pagamento", () => {
    expect(datasDaFatura("2026-11", 28, null)).toEqual({
      fecha: "2026-11-28",
      paga: null,
      inicio: "2026-10-29",
    });
    expect(datasDaFatura("2026-11", null, 5)).toEqual({
      fecha: null,
      paga: "2026-11-05",
      inicio: null,
    });
  });
  it("é coerente com faturaPadrao: a compra de 15/10 (fecha 28, vence 5) cai na fatura paga em 05/11", () => {
    const mes = faturaPadrao("2026-10-15", 28, 5);
    const d = datasDaFatura(mes, 28, 5);
    expect(mes).toBe("2026-11");
    expect("2026-10-15" >= d.inicio! && "2026-10-15" <= d.fecha!).toBe(true);
  });
  it("formata", () => {
    expect(dataBR("2026-11-05")).toBe("05/11/2026");
    expect(dataBR("2026-11-05", true)).toBe("05/11");
  });
});

describe("conta na célula de valor", () => {
  it.each([
    ["=16+105,80", 121_80],
    ["=(50+30)*2", 160_00],
    ["=1.000,50-0,50", 1000_00],
    ["=99,8*3", 299_40],
    ["=10/4", 2_50],
    ["= 5 x 2", 10_00],
  ])("%s → %i", (t, c) => expect(parseValor(t)).toBe(c));
  it.each(["=", "=1+", "=2*(3", "=1/0", "=abc", "=5-10"])("%s é inválida", (t) =>
    expect(parseValor(t)).toBeNull(),
  );
  it("calcula em reais", () => expect(calcularExpressao("=0,1+0,2")).toBeCloseTo(0.3));
});
