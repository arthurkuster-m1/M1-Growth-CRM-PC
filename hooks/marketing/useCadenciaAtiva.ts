"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { LeadEmCadencia } from "@/lib/cadencia/hoje";

/** Onde cada lead em cadência está, por id do lead. */
export function useCadenciaAtiva(ativo = true) {
  const consulta = useQuery({
    queryKey: ["cadence-ativos"],
    enabled: ativo,
    queryFn: async () =>
      (await apiClient.get<{ data: { leads: LeadEmCadencia[] } }>("/api/v1/cadence/ativos")).data
        .leads,
    staleTime: 30_000,
  });
  const porLead = new Map((consulta.data ?? []).map((l) => [l.lead_id, l] as const));
  return { leads: consulta.data ?? [], porLead };
}
