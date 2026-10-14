import { somarDias } from "@/lib/inicio/datas";

/** Contas puras do dashboard Business (a rota busca; aqui se calcula). */

export function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

export function media(valores: readonly number[]): number | null {
  return valores.length === 0 ? null : valores.reduce((s, v) => s + v, 0) / valores.length;
}

/** Dias entre duas datas `AAAA-MM-DD` (b − a). */
export function diasEntreDatas(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) /
      86_400_000,
  );
}

/** "AAAA-MM" de uma data. */
export const mesDe = (data: string) => data.slice(0, 7);

/** Os N meses terminando no mês de `ate` (do mais antigo ao mais novo), como "AAAA-MM". */
export function ultimosMeses(ate: string, n: number): string[] {
  const [a, m] = ate.split("-").map(Number) as [number, number];
  const meses: string[] = [];
  for (let k = n - 1; k >= 0; k -= 1) {
    const d = new Date(Date.UTC(a, m - 1 - k, 1));
    meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}

export function maisMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A data de corte de "cliente ativo": comprou nos últimos `meses` meses (a partir de `hoje`). */
export function corteDoAtivo(hoje: string, meses: number): string {
  const [a, m, d] = hoje.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(a, m - 1 - meses, d));
  return dt.toISOString().slice(0, 10);
}

export { somarDias };
