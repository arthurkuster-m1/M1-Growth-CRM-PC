"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type {
  Diagnostico,
  EntradaDoHistorico,
  ItemDoPlanoVisao,
  PerfilGravado,
} from "@/lib/guia/tipos";

export const CHAVE_DO_GUIA = ["guia", "diagnostico"] as const;

export interface RespostaDoGuia {
  perfil: PerfilGravado | null;
  diagnostico: Diagnostico;
  /** O plano do cliente, cruzado com o diagnóstico e as tarefas. */
  plano: ItemDoPlanoVisao[];
  historico: EntradaDoHistorico[];
  /** `false` quando falta a migration 0703 (o plano fica indisponível, o resto funciona). */
  planoDisponivel: boolean;
}

/** O diagnóstico do Guia da empresa ativa. Compartilhado entre a tela do Guia e o cartão do Início. */
export function useDiagnosticoDoGuia(opts: { ativo?: boolean } = {}) {
  return useQuery({
    queryKey: CHAVE_DO_GUIA,
    queryFn: async () =>
      (await apiClient.get<{ data: RespostaDoGuia }>("/api/v1/guia/diagnostico")).data,
    retry: false,
    staleTime: 30_000,
    enabled: opts.ativo ?? true,
  });
}
