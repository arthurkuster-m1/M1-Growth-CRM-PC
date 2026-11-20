/** Dinheiro e datas do módulo de Finanças. Dinheiro é SEMPRE inteiro em centavos; datas são "AAAA-MM-DD" locais (nunca UTC). */

const pad = (n: number) => String(n).padStart(2, "0");

export function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const mesDe = (data: string) => data.slice(0, 7);
export const mesAtual = () => mesDe(hoje());

/** "2026-10" → { de: "2026-10-01", ate: "2026-11-01" } (ate é exclusivo). */
export function intervaloDoMes(mes: string): { de: string; ate: string } {
  return { de: `${mes}-01`, ate: `${mesSeguinte(mes)}-01` };
}

export function mesSeguinte(mes: string): string {
  const [a = 0, m = 0] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${pad(m + 1)}`;
}

export function mesAnterior(mes: string): string {
  const [a = 0, m = 0] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${pad(m - 1)}`;
}

export const mesValido = (s: string | null): s is string =>
  !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function nomeDoMes(mes: string): string {
  const [a = 0, m = 0] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(a, m - 1, 1),
  );
}

export const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function dataLonga(d: string): string {
  const [a = 0, m = 0, dia = 0] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(a, m - 1, dia));
}

/** Número escrito em pt-BR ("1.234,56", "105,80", "99.8") → número; ilegível → null. */
function numeroBR(t: string): number | null {
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

/**
 * Conta de planilha: "=16+105,80", "=(50+30)*2", "=100/3". Aceita + − * / x ( ) e números em pt-BR, com ou sem o "=".
 * Devolve o resultado em REAIS (ou null se a expressão for inválida ou divisão por zero).
 */
export function calcularExpressao(texto: string): number | null {
  const t = texto
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/^=/, "")
    .replace(/[×x]/gi, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  const tokens = t.match(/\d[\d.,]*|[-+*/()]|./g) ?? [];
  let i = 0;
  const falha = Symbol();
  const expr = (): number => {
    let v = termo();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const op = tokens[i++];
      const r = termo();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const termo = (): number => {
    let v = fator();
    while (tokens[i] === "*" || tokens[i] === "/") {
      const op = tokens[i++];
      const r = fator();
      if (op === "/" && r === 0) throw falha;
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const fator = (): number => {
    const k = tokens[i++];
    if (k === "-") return -fator();
    if (k === "+") return fator();
    if (k === "(") {
      const v = expr();
      if (tokens[i++] !== ")") throw falha;
      return v;
    }
    const n = k === undefined ? null : numeroBR(k);
    if (n === null) throw falha;
    return n;
  };
  try {
    const v = expr();
    return i === tokens.length && Number.isFinite(v) ? v : null;
  } catch (e) {
    if (e === falha) return null;
    throw e;
  }
}

/** Texto digitado → centavos. Aceita "1.234,56", "1234,56", "1234.56", "R$ 12,5" e contas começando com "=" ("=16+105,80"). Inválido ou negativo → null. */
export function parseValor(texto: string): number | null {
  if (texto.trim().startsWith("=")) {
    const v = calcularExpressao(texto);
    return v === null || v < 0 ? null : Math.round(v * 100);
  }
  let t = texto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!t || t.startsWith("-")) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Campo estilo banco: o usuário digita só dígitos e as duas últimas casas são os centavos ("4590" → 4590). */
export function digitosParaCentavos(texto: string): number {
  const d = texto.replace(/\D/g, "").slice(0, 12);
  return d ? parseInt(d, 10) : 0;
}

/** 4590 → "45,90" (sem símbolo, para dentro do campo). 0 → "". */
export function centavosParaCampo(c: number): string {
  if (!c) return "";
  return (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "2026-11" → "Nov/26". */
export function mesCurto(mes: string): string {
  const [a = 0, m = 0] = mes.split("-").map(Number);
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(a, m - 1, 1))
    .replace(".", "");
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${String(a).slice(-2)}`;
}

/**
 * Em qual fatura cai uma compra — nomeada pelo mês em que é PAGA (quando o dinheiro sai do caixa).
 * 1) depois do dia de fechamento a compra vai para o ciclo seguinte; 2) se o vencimento é até o dia do
 * fechamento (ex.: fecha 28, vence 5), a fatura é paga no mês depois do fechamento.
 * Mesma regra do gatilho do banco (fn_fin_tx_fatura) — se uma mudar, a outra também.
 */
export function faturaPadrao(
  data: string,
  diaFechamento: number | null,
  diaVencimento: number | null = null,
): string {
  const mes = mesDe(data);
  const ciclo = Number(data.slice(8, 10)) > (diaFechamento ?? 31) ? mesSeguinte(mes) : mes;
  return diaVencimento != null && diaFechamento != null && diaVencimento <= diaFechamento
    ? mesSeguinte(ciclo)
    : ciclo;
}

/** "120", "120%", "10,5", "10.5" → número; vazio, zero, negativo ou acima de 1000 → null. */
export function parsePercentual(texto: string): number | null {
  const t = texto.replace("%", "").replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= 1000 ? n : null;
}

/** 10.5 → "10,5"; 120 → "120". */
export const percentualParaCampo = (n: number | null) =>
  n == null ? "" : String(Number(n)).replace(".", ",");

/* ───── Datas de uma fatura: fechamento e PAGAMENTO ───── */
const pad2 = (n: number) => String(n).padStart(2, "0");
/** Dia do mês, limitado ao último dia (fecha dia 31 em novembro = 30). */
export function diaNoMes(mes: string, dia: number): string {
  const [a = 0, m = 0] = mes.split("-").map(Number);
  return `${mes}-${pad2(Math.min(dia, new Date(a, m, 0).getDate()))}`;
}
const somaDia = (iso: string, n: number) => {
  const [a = 0, m = 0, d = 0] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

/**
 * Datas da fatura identificada pelo MÊS DO PAGAMENTO (a fatura "de novembro" é a que sai do caixa em novembro).
 * `fecha` = dia em que fecha; `paga` = dia do vencimento; `inicio` = primeiro dia das compras que entram nela.
 * Mesma regra de faturaPadrao: vencimento até o dia do fechamento = paga no mês seguinte ao fechamento.
 */
export function datasDaFatura(
  mesPagamento: string,
  fechamento: number | null,
  vencimento: number | null,
): { fecha: string | null; paga: string | null; inicio: string | null } {
  const paga = vencimento != null ? diaNoMes(mesPagamento, vencimento) : null;
  if (fechamento == null) return { fecha: null, paga, inicio: null };
  const mesFecha =
    vencimento != null && vencimento <= fechamento ? mesAnterior(mesPagamento) : mesPagamento;
  const fecha = diaNoMes(mesFecha, fechamento);
  return { fecha, paga, inicio: somaDia(diaNoMes(mesAnterior(mesFecha), fechamento), 1) };
}

/** "2026-11-05" → "05/11/2026" (ou "05/11" com curto). */
export const dataBR = (iso: string, curto = false) =>
  curto
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
    : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
