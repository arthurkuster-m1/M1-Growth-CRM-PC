import { describe, expect, it } from "vitest";
import type { Categoria, Conta, Lancamento } from "./tipos";
import { compararAnos, metricasDoAno } from "./compararAnos";

const conta = (id: string, tipo: string) =>
  ({ id, nome: id, tipo, ativa: true }) as unknown as Conta;
const contas = [conta("cc", "corrente"), conta("inv", "investida")];
const cats = [] as Categoria[];
const l = (
  id: string,
  data: string,
  tipo: Lancamento["tipo"],
  v: number,
  o: Partial<Lancamento> = {},
) =>
  ({
    id,
    data,
    tipo,
    valor_cents: v,
    status: "pago",
    nota: null,
    category_id: null,
    account_id: "cc",
    account_destino_id: null,
    fatura_mes: null,
    ...o,
  }) as Lancamento;
describe("metricasDoAno / compararAnos", () => {
  const m25 = metricasDoAno({
    ano: 2025,
    hoje: "2026-11-03",
    contas,
    categorias: cats,
    patrimonioFim: 1000_00,
    lancamentos: [
      l("1", "2025-02-01", "entrada", 1200_00),
      l("2", "2025-03-01", "saida", 600_00),
      l("3", "2025-04-01", "transferencia", 100_00, { account_destino_id: "inv" }),
    ],
  });
  const m26 = metricasDoAno({
    ano: 2026,
    hoje: "2026-11-03",
    contas,
    categorias: cats,
    patrimonioFim: 3000_00,
    lancamentos: [
      l("4", "2026-02-01", "entrada", 1200_00),
      l("5", "2026-03-01", "saida", 900_00),
      l("6", "2026-04-01", "transferencia", 500_00, { account_destino_id: "inv" }),
      l("7", "2026-05-01", "transferencia", 100_00, {
        account_id: "inv",
        account_destino_id: "cc",
      }),
    ],
  });
  it("métricas", () => {
    expect(m25).toMatchObject({
      entradas: 1200_00,
      saidas: 600_00,
      aportes: 100_00,
      mediaSaidas: 200_00,
      meses: 3,
    });
    expect(m26).toMatchObject({ aportes: 400_00, meses: 3 });
  });
  it("diferença e %", () => {
    const r = Object.fromEntries(compararAnos(m25, m26).map((x) => [x.chave, x]));
    expect(r.saidas).toMatchObject({ dif: 300_00, pct: 50 });
    expect(r.aportes).toMatchObject({ dif: 300_00, pct: 300 });
    expect(r.patrimonio).toMatchObject({ dif: 2000_00, pct: 200 });
  });
  it("base zero → % nulo", () =>
    expect(
      compararAnos({ ...m25, aportes: 0 }, m26).find((x) => x.chave === "aportes")!.pct,
    ).toBeNull());
  it("previstos entram nas somas (entradas, saídas, aportes) e na divisão das médias", () => {
    const m = metricasDoAno({
      ano: 2026,
      hoje: "2026-11-03",
      contas,
      categorias: cats,
      patrimonioFim: 0,
      lancamentos: [
        l("a", "2026-02-01", "entrada", 1000_00),
        l("b", "2026-12-05", "entrada", 500_00, { status: "pendente" }),
        l("c", "2026-12-10", "saida", 300_00, { status: "pendente" }),
        l("d", "2026-12-12", "transferencia", 200_00, {
          status: "pendente",
          account_destino_id: "inv",
        }),
      ],
    });
    expect(m).toMatchObject({
      entradas: 1500_00,
      saidas: 300_00,
      aportes: 200_00,
      meses: 12,
      mediaEntradas: 125_00,
    });
  });
});
