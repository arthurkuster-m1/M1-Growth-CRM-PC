import type { PeriodoDoOrcamento } from "@/lib/marketing/campanhas";
import { investimentoLiquido } from "@/lib/marketing/campanhas";

/** Os dias que a campanha dura; sem datas (ou contínua), o mês: 30 dias. */
export function diasParaOrcamento(c: {
  start_date: string | null;
  end_date: string | null;
  continuous: boolean;
}): { dias: number; baseadoNoMes: boolean } {
  if (!c.continuous && c.start_date && c.end_date && c.end_date >= c.start_date) {
    const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
    return {
      dias: Math.round((ms(c.end_date) - ms(c.start_date)) / 86_400_000) + 1,
      baseadoNoMes: false,
    };
  }
  return { dias: 30, baseadoNoMes: true };
}

export interface EquivalenciaDoOrcamento {
  periodo: PeriodoDoOrcamento;
  bruto: number;
  liquido: number;
}

const SEMANA = 7;
const MES = 30;

/**
 * Quanto o orçamento digitado vale em cada medida — total da campanha, por mês (30 dias), por
 * semana e por dia —, bruto e líquido (sem o imposto). O que o gestor digitou volta igual na sua
 * própria medida; as outras saem da taxa diária.
 */
export function equivalenciasDoOrcamento(
  valor: number,
  periodo: PeriodoDoOrcamento,
  dias: number,
  impostoPct: number,
): EquivalenciaDoOrcamento[] {
  const porDia =
    periodo === "diario"
      ? valor
      : periodo === "semanal"
        ? valor / SEMANA
        : periodo === "mensal"
          ? valor / MES
          : valor / Math.max(1, dias);
  const brutos: Record<PeriodoDoOrcamento, number> = {
    total: porDia * dias,
    mensal: porDia * MES,
    semanal: porDia * SEMANA,
    diario: porDia,
  };
  // O que foi digitado volta exatamente igual (sem erro de arredondamento da conta inversa).
  brutos[periodo] = valor;
  return (["total", "mensal", "semanal", "diario"] as const).map((p) => ({
    periodo: p,
    bruto: brutos[p],
    liquido: investimentoLiquido(brutos[p], impostoPct),
  }));
}
