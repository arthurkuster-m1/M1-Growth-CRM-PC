"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { chaveDaFicha, type DadosDoLead } from "@/components/leads/FichaDoLead";
import { apiClient } from "@/lib/api/client";

export interface FunilDoContato {
  lead_id: string;
  status: "open" | "won" | "lost" | string;
  entrou_em: string;
  funil: string;
  etapa: string;
}

export interface QualificacaoDoContato {
  entrou_em: string;
  primeira_abordagem: string | null;
  primeira_compra: string | null;
  is_mql: boolean;
  mql_at: string | null;
  funis: FunilDoContato[];
}

/** Os funis (negócios) do contato + as datas de qualificação. */
export function useQualificacaoDoContato(contactId: string) {
  return useQuery({
    queryKey: ["qualificacao-do-lead", contactId],
    staleTime: 15_000,
    queryFn: async () =>
      (await apiClient.get<{ data: QualificacaoDoContato }>(`/api/v1/contacts/${contactId}/qualificacao`))
        .data,
  });
}

/** O detalhe de cada negócio (origem, rastreamento, campos, datas) — o mesmo dado da ficha antiga. */
export function useDadosDosNegocios(leadIds: readonly string[]) {
  const consultas = useQueries({
    queries: leadIds.map((id) => ({
      queryKey: chaveDaFicha(id),
      staleTime: 10_000,
      queryFn: async () =>
        (await apiClient.get<{ data: DadosDoLead }>(`/api/v1/leads/${id}/origem`)).data,
    })),
  });
  return {
    carregando: consultas.some((c) => c.isLoading),
    dados: consultas.flatMap((c) => (c.data ? [c.data] : [])),
    recarregar: () => consultas.forEach((c) => void c.refetch()),
  };
}
