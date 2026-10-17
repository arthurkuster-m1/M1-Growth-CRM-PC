"use client";

import { useQuery } from "@tanstack/react-query";

import type { ModeloDeAtendimentoDoTipo } from "@/lib/agenda/modelos-de-atendimento";
import { apiClient } from "@/lib/api/client";

/** A página de atendimento de cada tipo (modelo, blocos e roteiro), por id do tipo. */
export function useModelosDeAtendimento() {
  return useQuery({
    queryKey: ["agenda", "modelos-de-atendimento"],
    staleTime: 20_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { modelos: Record<string, ModeloDeAtendimentoDoTipo> } }>("/api/v1/agenda/modelos-de-atendimento"))
        .data.modelos,
  });
}
