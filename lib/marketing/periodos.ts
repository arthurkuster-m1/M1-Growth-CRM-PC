import { somarDias } from "@/lib/inicio/datas";

/**
 * OS PERÍODOS das metas e dos resultados: um nome ("este mês", "últimos 5 dias") vira o par
 * `de`/`ate` (datas `AAAA-MM-DD`, inclusive os dois). Puro: recebe o "hoje" já no fuso certo.
 *
 * ⚠️ A FORMA de `PERIODOS` é requisito de instrumento (extrator do vocabulário banco×TS: o CHECK
 * de `marketing_cronograma_metas.period` repete esta lista).
 */
export const PERIODOS = [
  "hoje",
  "ontem",
  "ultimos_5_dias",
  "ultimos_7_dias",
  "ultimos_30_dias",
  "semana",
  "mes",
  "mes_passado",
  "trimestre",
  "semestre",
  "ano",
] as const;
export type Periodo = (typeof PERIODOS)[number];

export interface JanelaDePeriodo {
  de: string;
  ate: string;
  /** Quantos dias tem a janela (para a média diária). */
  dias: number;
}

/** O domingo da semana que contém a data (a semana do produto começa no domingo). */
function domingoDe(iso: string): string {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return somarDias(iso, -dow);
}

const dias = (iso: string) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;
const contar = (de: string, ate: string) => Math.max(1, dias(ate) - dias(de) + 1);

export function janelaDoPeriodo(periodo: Periodo, hoje: string): JanelaDePeriodo {
  let de = hoje;
  let ate = hoje;
  switch (periodo) {
    case "hoje":
      break;
    case "ontem":
      de = ate = somarDias(hoje, -1);
      break;
    case "ultimos_5_dias":
      de = somarDias(hoje, -4);
      break;
    case "ultimos_7_dias":
      de = somarDias(hoje, -6);
      break;
    case "ultimos_30_dias":
      de = somarDias(hoje, -29);
      break;
    case "semana":
      de = domingoDe(hoje);
      ate = somarDias(de, 6);
      break;
    case "mes": {
      de = `${hoje.slice(0, 7)}-01`;
      const [a, m] = hoje.split("-").map(Number) as [number, number];
      ate = `${hoje.slice(0, 7)}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
      break;
    }
    case "trimestre":
    case "semestre": {
      const [a, m] = hoje.split("-").map(Number) as [number, number];
      const tamanho = periodo === "trimestre" ? 3 : 6;
      const primeiro = Math.floor((m - 1) / tamanho) * tamanho; // índice 0-based do 1º mês
      de = `${a}-${String(primeiro + 1).padStart(2, "0")}-01`;
      const ultimo = primeiro + tamanho; // mês seguinte ao último (1-based = ultimo)
      ate = `${a}-${String(ultimo).padStart(2, "0")}-${String(
        new Date(Date.UTC(a, ultimo, 0)).getUTCDate(),
      ).padStart(2, "0")}`;
      break;
    }
    case "ano": {
      const a = hoje.slice(0, 4);
      de = `${a}-01-01`;
      ate = `${a}-12-31`;
      break;
    }
    case "mes_passado": {
      const [a, m] = hoje.split("-").map(Number) as [number, number];
      const d = new Date(Date.UTC(a, m - 2, 1));
      const ano = d.getUTCFullYear();
      const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
      de = `${ano}-${mes}-01`;
      ate = `${ano}-${mes}-${String(new Date(Date.UTC(ano, d.getUTCMonth() + 1, 0)).getUTCDate()).padStart(2, "0")}`;
      break;
    }
  }
  return { de, ate, dias: contar(de, ate) };
}

/** Os dias do período que JÁ passaram (para a média diária do mês em andamento). */
export function diasDecorridos(j: JanelaDePeriodo, hoje: string): number {
  if (hoje >= j.ate) return j.dias;
  if (hoje < j.de) return 1;
  return contar(j.de, hoje);
}

/** A janela de um período escolhido à mão (datas `AAAA-MM-DD`, inclusive os dois dias). */
export function janelaPersonalizada(de: string, ate: string): JanelaDePeriodo {
  return { de, ate, dias: contar(de, ate) };
}
