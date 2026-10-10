/**
 * A CALCULADORA DA META — a matemática do planejamento: da meta de faturamento ao número de
 * vendas, leads e investimento. Funções puras; os números digitados ficam no bloco e o
 * resultado é recalculado na hora de mostrar (por isso nunca fica desatualizado).
 */
export interface EntradasDaCalculadora {
  meta: string;
  ticket: string;
  conversao: string;
  cpl: string;
  margem: string;
  retencao: string;
}

export interface ResultadoDaCalculadora {
  vendas: number | null;
  leads: number | null;
  investimento: number | null;
  cac: number | null;
  roas: number | null;
  lucro: number | null;
  ltv: number | null;
  ltvSobreCac: number | null;
}

/** "R$ 1.500,50", "1500.5", "12%" → número; vazio ou ilegível → null. */
export function lerNumero(texto: string): number | null {
  let s = texto.trim().replace(/[^\d.,-]/g, "");
  if (s === "" || s === "-") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  else if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(".", "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function calcular(e: EntradasDaCalculadora): ResultadoDaCalculadora {
  const meta = lerNumero(e.meta);
  const ticket = lerNumero(e.ticket);
  const conversao = lerNumero(e.conversao);
  const cpl = lerNumero(e.cpl);
  const margem = lerNumero(e.margem);
  const retencao = lerNumero(e.retencao);

  const vendas = meta !== null && ticket !== null && ticket > 0 ? Math.ceil(meta / ticket) : null;
  const leads =
    vendas !== null && conversao !== null && conversao > 0
      ? Math.ceil(vendas / (conversao / 100))
      : null;
  const investimento = leads !== null && cpl !== null ? leads * cpl : null;
  const cac = investimento !== null && vendas !== null && vendas > 0 ? investimento / vendas : null;
  const roas =
    investimento !== null && investimento > 0 && meta !== null ? meta / investimento : null;
  const lucro =
    meta !== null && margem !== null && investimento !== null
      ? meta * (margem / 100) - investimento
      : null;
  const ltv = ticket !== null && retencao !== null ? ticket * retencao : null;
  const ltvSobreCac = ltv !== null && cac !== null && cac > 0 ? ltv / cac : null;
  return { vendas, leads, investimento, cac, roas, lucro, ltv, ltvSobreCac };
}

export const moeda = (n: number): string =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
