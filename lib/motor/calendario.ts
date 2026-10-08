import { diaDaSemanaDaChave, somarDias } from "@/lib/inicio/datas";

/**
 * Contas de calendário das visualizações Calendário e Linha do tempo. Puro, sobre CHAVES de
 * dia (`YYYY-MM-DD`) já calculadas no fuso da organização — nunca sobre instantes.
 */

/** Primeiro dia (`YYYY-MM-01`) do mês de `chave`. */
export const inicioDoMes = (chave: string): string => `${chave.slice(0, 7)}-01`;

/** Soma meses a um `YYYY-MM-01`. */
export function somarMeses(chave: string, meses: number): string {
  const [ano, mes] = chave.split("-").map(Number);
  const total = ano! * 12 + (mes! - 1) + meses;
  const a = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${a}-${String(m).padStart(2, "0")}-01`;
}

/**
 * Todos os dias que o mês ocupa na grade, de segunda a domingo, em semanas inteiras
 * (inclui os dias vizinhos que completam a primeira e a última semana).
 */
export function diasDaGradeDoMes(chaveDoMes: string): string[] {
  const primeiro = inicioDoMes(chaveDoMes);
  const proximo = somarMeses(primeiro, 1);
  const ultimo = somarDias(proximo, -1);
  const inicio = somarDias(primeiro, -diaDaSemanaDaChave(primeiro));
  const fim = somarDias(ultimo, 6 - diaDaSemanaDaChave(ultimo));
  const dias: string[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

/** `n` dias seguidos a partir de `inicio`. */
export const diasSeguidos = (inicio: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => somarDias(inicio, i));

/** Dias inteiros entre duas chaves (`b - a`). */
export function diferencaEmDias(a: string, b: string): number {
  const ms = (c: string) => {
    const [ano, mes, dia] = c.split("-").map(Number);
    return Date.UTC(ano!, mes! - 1, dia!);
  };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}
