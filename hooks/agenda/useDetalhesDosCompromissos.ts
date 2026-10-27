"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { DetalheDoCompromisso } from "@/lib/agenda/propriedades-do-compromisso";

/** As propriedades extras dos compromissos do dia aberto (só buscadas quando alguma é escolhida). */
export function useDetalhesDosCompromissos(ids: string[], ativo: boolean) {
  const chave = [...ids].sort();
  return useQuery({
    queryKey: ["agenda", "detalhes", chave],
    enabled: ativo && chave.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, DetalheDoCompromisso>> => {
      const r = await apiClient.get<{ data: { detalhes: DetalheDoCompromisso[] } }>(
        `/api/v1/agenda/detalhes?ids=${chave.join(",")}`,
      );
      return new Map(r.data.detalhes.map((d) => [d.id, d]));
    },
  });
}
