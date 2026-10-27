"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { RelatorioDePerdas } from "@/lib/metrics/perdas";

export interface PerdasPayload extends RelatorioDePerdas {
  janela: { from: string; to: string };
  /** A leitura bateu no teto: o relatório está cortado, não completo. */
  truncado: boolean;
}

/** O período escolhido, em dias `YYYY-MM-DD` (inclusive nas duas pontas). */
export interface PeriodoDePerdas {
  de: string;
  ate: string;
}

/**
 * Relatório "Perdas" (issue #1537) — manager+. Sem período, os últimos 30 dias; com período, o dia
 * `de` à meia-noite até o fim do dia `ate`, na hora local de quem olha.
 */
export function usePerdasMetrics(enabled = true, periodo?: PeriodoDePerdas) {
  return useQuery({
    queryKey: ["metrics", "perdas", periodo?.de ?? null, periodo?.ate ?? null],
    queryFn: async () => {
      if (!periodo) return apiClient.get<{ data: PerdasPayload }>("/api/v1/metrics/lost");
      const from = new Date(`${periodo.de}T00:00:00`);
      const to = new Date(`${periodo.ate}T00:00:00`);
      to.setDate(to.getDate() + 1);
      const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      return apiClient.get<{ data: PerdasPayload }>(`/api/v1/metrics/lost?${qs.toString()}`);
    },
    staleTime: 30_000,
    enabled,
  });
}
