import { diaNoMes, mesSeguinte } from "./formato";

export type Parcela = {
  numero: number;
  total: number;
  data: string;
  fatura: string;
  valor_cents: number;
};

export const MAX_PARCELAS = 60;

/**
 * Divide uma compra em N parcelas, uma por fatura seguinte.
 * - `modo: "total"`: o valor é o da compra; centavos que sobram da divisão vão para as PRIMEIRAS parcelas
 *   (R$ 100,00 em 3 = 33,34 + 33,33 + 33,33 — a soma fecha sempre).
 * - `modo: "parcela"`: o valor é o de cada parcela; o total é valor × N.
 * A data da parcela k é a da compra deslocada k meses (dia 31 vira o último dia do mês curto);
 * a fatura da parcela k é a inicial deslocada k meses.
 */
export function gerarParcelas(a: {
  data: string;
  faturaInicial: string;
  n: number;
  modo: "total" | "parcela";
  valor_cents: number;
}): Parcela[] {
  const n = Math.floor(a.n);
  if (!(n >= 1 && n <= MAX_PARCELAS) || !(a.valor_cents > 0)) return [];
  const total = a.modo === "total" ? a.valor_cents : a.valor_cents * n;
  const base = Math.floor(total / n),
    resto = total - base * n;
  const dia = Number(a.data.slice(8, 10));
  const out: Parcela[] = [];
  let mesData = a.data.slice(0, 7),
    fatura = a.faturaInicial;
  for (let i = 0; i < n; i++) {
    out.push({
      numero: i + 1,
      total: n,
      data: i === 0 ? a.data : diaNoMes(mesData, dia),
      fatura,
      valor_cents: base + (i < resto ? 1 : 0),
    });
    mesData = mesSeguinte(mesData);
    fatura = mesSeguinte(fatura);
  }
  return out;
}

export const totalDasParcelas = (ps: Parcela[]) => ps.reduce((s, p) => s + p.valor_cents, 0);
