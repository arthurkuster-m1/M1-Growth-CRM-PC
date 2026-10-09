import { diaDaSemanaDaChave, inicioDoDia, partesNoFuso, somarDias } from "@/lib/inicio/datas";

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
export function diasDaGradeDoMes(chaveDoMes: string, comecaNoDomingo = false): string[] {
  const primeiro = inicioDoMes(chaveDoMes);
  const proximo = somarMeses(primeiro, 1);
  const ultimo = somarDias(proximo, -1);
  // `diaDaSemanaDaChave`: 0 = segunda … 6 = domingo. Semana de domingo a sábado: desloca um.
  const coluna = (chave: string) =>
    comecaNoDomingo ? (diaDaSemanaDaChave(chave) + 1) % 7 : diaDaSemanaDaChave(chave);
  const inicio = somarDias(primeiro, -coluna(primeiro));
  const fim = somarDias(ultimo, 6 - coluna(ultimo));
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

/**
 * O mesmo instante, em outro DIA: muda a data e mantém a hora de parede no fuso (14:00
 * continua 14:00). Sem instante de partida (`null`), vale o começo do dia.
 */
export function trocarODia(iso: string | null | undefined, dia: string, fuso: string): string {
  const base = inicioDoDia(dia, fuso).getTime();
  if (!iso) return new Date(base).toISOString();
  const p = partesNoFuso(new Date(iso), fuso);
  return new Date(base + (p.hora * 60 + p.minuto) * 60_000).toISOString();
}

/** `2026-10-09` → `09/10/2026` (dia/mês/ano, como a pessoa lê). Vazio se a chave não é um dia. */
export function formatarDiaBr(chave: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(chave);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** `9/10/2026` ou `09/10/26` → `2026-10-09`; `null` se não for um dia que existe. */
export function lerDiaBr(texto: string): string | null {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\s*$/.exec(texto);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // Rejeita 31/02: o Date "corrige" para março, e a volta não bate.
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
