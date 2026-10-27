"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { AtritoRaw, Par } from "@/lib/metrics/atrito";

export interface AtritoMetrics {
  window: { from: string; to: string };
  escopo: AtritoRaw["escopo"];
  /** Pares eficiência/dano — nunca uma lista solta de números (doutrina §3.3). */
  pares: Par[];
  /** A régua em vigor + o default, para a tela dizer de onde o número veio. */
  regua: { abandono_horas: number; default: number };
  componentes: { cliente: AtritoRaw["cliente"]; empresa: AtritoRaw["empresa"] };
}

/**
 * Muda a régua do abandono (manager+). Invalida o índice inteiro: a régua muda
 * o número, então manter o painel antigo na tela seria exibir um valor que já
 * não corresponde à definição salva.
 */
export function useSalvarReguaAbandono() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (abandono_horas: number) =>
      apiClient.patch<{ data: { abandono_horas: number } }>("/api/v1/metrics/atrito", {
        abandono_horas,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["metrics", "atrito"] }),
  });
}

/**
 * Spec 17 — o Índice de Atrito. Mede o propósito, não a atividade. Sem período, os últimos 30 dias;
 * com período (dias `YYYY-MM-DD`, inclusive), do início do dia `de` ao fim do dia `ate`.
 */
export function useAtritoMetrics(periodo?: { de: string; ate: string }, enabled = true) {
  return useQuery({
    queryKey: ["metrics", "atrito", periodo?.de ?? null, periodo?.ate ?? null],
    enabled,
    queryFn: async () => {
      if (!periodo) return apiClient.get<{ data: AtritoMetrics }>("/api/v1/metrics/atrito");
      const from = new Date(`${periodo.de}T00:00:00`);
      const to = new Date(`${periodo.ate}T00:00:00`);
      to.setDate(to.getDate() + 1);
      const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      return apiClient.get<{ data: AtritoMetrics }>(`/api/v1/metrics/atrito?${qs.toString()}`);
    },
    staleTime: 30_000,
  });
}
