/**
 * Datas da tela Início — sempre no FUSO da organização, nunca no do navegador.
 *
 * "Hoje" é uma pergunta com fuso: às 22h em São Paulo já é amanhã em UTC, e uma
 * tarefa "de hoje" que sumisse da lista às 21h (por causa do `toISOString()`)
 * seria o tipo de bug que ninguém reproduz de manhã. Por isso toda conta de dia
 * passa por uma CHAVE `YYYY-MM-DD` calculada no fuso, e a aritmética de dias
 * acontece sobre a chave (calendário puro), não sobre instantes.
 *
 * Puro e sem React: dá para testar fixando o relógio e o fuso.
 */

export interface PartesDoDia {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

/** Ano, mês, dia, hora e minuto de um instante, vistos de dentro do fuso. */
export function partesNoFuso(instante: Date, fuso: string): PartesDoDia {
  const formato = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const parte of formato.formatToParts(instante)) {
    if (parte.type !== "literal") p[parte.type] = Number(parte.value);
  }
  return { ano: p.year!, mes: p.month!, dia: p.day!, hora: p.hour!, minuto: p.minute! };
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` do instante, no fuso. */
export function chaveDoDia(instante: Date, fuso: string): string {
  const { ano, mes, dia } = partesNoFuso(instante, fuso);
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

function dataUtcDaChave(chave: string): Date {
  const [ano, mes, dia] = chave.split("-").map(Number);
  // Meio-dia: longe o bastante de qualquer virada para a conta de dias não escorregar.
  return new Date(Date.UTC(ano!, mes! - 1, dia!, 12));
}

/** Soma (ou subtrai) dias de calendário a uma chave. */
export function somarDias(chave: string, dias: number): string {
  const d = dataUtcDaChave(chave);
  d.setUTCDate(d.getUTCDate() + dias);
  return `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}-${doisDigitos(d.getUTCDate())}`;
}

/** 0 = segunda … 6 = domingo (a semana do Início começa na segunda). */
export function diaDaSemanaDaChave(chave: string): number {
  return (dataUtcDaChave(chave).getUTCDay() + 6) % 7;
}

/** As sete chaves da semana (segunda → domingo) que contém `chave`. */
export function diasDaSemana(chave: string): string[] {
  const segunda = somarDias(chave, -diaDaSemanaDaChave(chave));
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
}

/**
 * O instante em que o dia `chave` COMEÇA (00:00) dentro do fuso.
 *
 * Duas passadas: a primeira estima o deslocamento do fuso; a segunda o corrige se a
 * estimativa caiu do outro lado de uma mudança de horário de verão.
 */
export function inicioDoDia(chave: string, fuso: string): Date {
  const [ano, mes, dia] = chave.split("-").map(Number);
  const alvo = Date.UTC(ano!, mes! - 1, dia!, 0, 0, 0);
  let chute = alvo;
  for (let i = 0; i < 2; i++) {
    const p = partesNoFuso(new Date(chute), fuso);
    const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
    chute = alvo - (comoUtc - chute);
  }
  return new Date(chute);
}

export type Saudacao = "bom_dia" | "boa_tarde" | "boa_noite";

export function saudacaoDaHora(hora: number): Saudacao {
  if (hora < 12) return "bom_dia";
  if (hora < 18) return "boa_tarde";
  return "boa_noite";
}
