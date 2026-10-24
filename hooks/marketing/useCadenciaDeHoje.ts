"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { PassoDeHoje } from "@/lib/cadencia/hoje";

/** Os passos de cadência que vencem hoje ou já venceram, por lead. */
export function useCadenciaDeHoje(ativo = true) {
  const consulta = useQuery({
    queryKey: ["cadence-hoje"],
    enabled: ativo,
    queryFn: async () =>
      (await apiClient.get<{ data: { passos: PassoDeHoje[] } }>("/api/v1/cadence/hoje")).data
        .passos,
    staleTime: 30_000,
  });
  const porLead = new Map((consulta.data ?? []).map((p) => [p.lead_id, p] as const));
  return { passos: consulta.data ?? [], porLead };
}
