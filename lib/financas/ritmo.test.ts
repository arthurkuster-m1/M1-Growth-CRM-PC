import { describe, expect, it } from "vitest";
import { ritmoDiario, ritmoGanho } from "./ritmo";

const cartao = (nome: string, fecha: number | null, vence: number | null = 5) => ({
  nome,
  dia_fechamento: fecha,
  dia_vencimento: vence,
  ativa: true,
});
const MP = cartao("Mercado Pago", 28, 5); // fecha dia 28, vence dia 5 → de 29/10 a 28/11 cai na fatura de DEZEMBRO

describe("ritmo diário do teto, com a virada do cartão", () => {
  it("DEZEMBRO visto em 3/11: compras no cartão até 28/11 caem em dezembro → por dia até a virada do cartão", () => {
    const r = ritmoDiario({
      mes: "2026-12",
      hoje: "2026-11-03",
      restante: 2600_00,
      cartoes: [MP],
    })!;
    expect(r).toMatchObject({
      fase: "cartao",
      ate: "2026-11-28",
      dias: 26,
      porDia: 100_00,
      cartao: { nome: "Mercado Pago", fecha: "2026-11-28" },
    }); // 3 a 28 = 26 dias
  });
  it("NOVEMBRO visto em 3/11: o cartão já virou para novembro (28/10) → só Pix/débito, por dia até 30/11", () => {
    const r = ritmoDiario({
      mes: "2026-11",
      hoje: "2026-11-03",
      restante: 2800_00,
      cartoes: [MP],
    })!;
    expect(r).toMatchObject({
      fase: "fim_do_mes",
      ate: "2026-11-30",
      dias: 28,
      porDia: 100_00,
      cartao: null,
      faturaAberta: "2026-12",
    }); // 3 a 30 = 28 dias; compras no cartão entram em dezembro
  });
  it("DEZEMBRO visto em 29/11 (o cartão virou): agora é Pix/débito até 31/12", () => {
    const r = ritmoDiario({
      mes: "2026-12",
      hoje: "2026-11-29",
      restante: 3100_00,
      cartoes: [MP],
    })!;
    expect(r).toMatchObject({ fase: "fim_do_mes", ate: "2026-12-31", dias: 31, porDia: 100_00 }); // mês futuro: desde o dia 1
  });
  it("no dia da virada (28/11) ainda conta como último dia do ciclo", () => {
    expect(
      ritmoDiario({ mes: "2026-12", hoje: "2026-11-28", restante: 300_00, cartoes: [MP] }),
    ).toMatchObject({ fase: "cartao", dias: 1, porDia: 300_00 });
  });
  it("em dezembro (mês corrente), depois da virada: por dia até 31/12 contando hoje", () => {
    const r = ritmoDiario({
      mes: "2026-12",
      hoje: "2026-12-10",
      restante: 2200_00,
      cartoes: [MP],
    })!;
    expect(r).toMatchObject({
      fase: "fim_do_mes",
      dias: 22,
      porDia: 100_00,
      faturaAberta: "2027-01",
    });
  });
  it("vários cartões: vale a virada do que fecha POR ÚLTIMO", () => {
    const r = ritmoDiario({
      mes: "2026-12",
      hoje: "2026-11-03",
      restante: 2600_00,
      cartoes: [cartao("Nubank", 20, 27), MP],
    })!;
    expect(r).toMatchObject({ fase: "cartao", ate: "2026-11-28" });
  });
  it("sem cartão: por dia até o fim do mês (mês corrente conta hoje; futuro, desde o dia 1)", () => {
    expect(
      ritmoDiario({ mes: "2026-11", hoje: "2026-11-03", restante: 2800_00, cartoes: [] }),
    ).toMatchObject({ fase: "fim_do_mes", dias: 28, porDia: 100_00 });
    expect(
      ritmoDiario({ mes: "2026-12", hoje: "2026-11-03", restante: 3100_00, cartoes: [] }),
    ).toMatchObject({ dias: 31, porDia: 100_00 });
  });
  it("teto esgotado não calcula por dia; mês passado: nada; cartão sem fechamento é ignorado", () => {
    expect(
      ritmoDiario({ mes: "2026-12", hoje: "2026-11-03", restante: -50_00, cartoes: [MP] }),
    ).toMatchObject({ esgotado: true, porDia: 0 });
    expect(
      ritmoDiario({ mes: "2026-09", hoje: "2026-11-03", restante: 1, cartoes: [] }),
    ).toBeNull();
    expect(
      ritmoDiario({
        mes: "2026-11",
        hoje: "2026-11-03",
        restante: 100_00,
        cartoes: [cartao("X", null)],
      })!.fase,
    ).toBe("fim_do_mes");
  });
});

describe("ritmoGanho", () => {
  it("divide o que falta ganhar pelos dias até o fim do mês (arredonda para cima)", () => {
    const r = ritmoGanho({ mes: "2026-11", hoje: "2026-11-03", restante: 28_000_00 });
    expect(r).toMatchObject({ batida: false, dias: 28, porDia: 1000_00, ate: "2026-11-30" });
    expect(ritmoGanho({ mes: "2026-12", hoje: "2026-11-03", restante: 31_000_00 })).toMatchObject({
      dias: 31,
      porDia: 1000_00,
    });
  });
  it("meta batida e mês passado", () => {
    expect(ritmoGanho({ mes: "2026-11", hoje: "2026-11-03", restante: 0 })?.batida).toBe(true);
    expect(ritmoGanho({ mes: "2026-10", hoje: "2026-11-03", restante: 5 })).toBeNull();
  });
});
