"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { ContinuacoesDoDisparo } from "@/lib/campanhas/fluxo-da-conversa";

export type AcaoDaContinuacao = "enviar" | "pular" | "reescrever" | "parar";

/** O fluxo da conversa de cada lead do disparo, e as decisões da pessoa sobre as mensagens propostas. */
export function useContinuacoes(campanhaId: string, ativo: boolean) {
  const qc = useQueryClient();
  const chave = ["continuacoes", campanhaId] as const;
  const consulta = useQuery({
    queryKey: chave,
    enabled: ativo,
    queryFn: async () =>
      (
        await apiClient.get<{ data: ContinuacoesDoDisparo }>(
          `/api/v1/campaigns/${campanhaId}/continuacoes`,
        )
      ).data,
    // A resposta do lead chega a qualquer hora: a lista se atualiza sozinha enquanto a tela está aberta.
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
  const decidir = useMutation({
    mutationFn: async (a: { id: string; acao: AcaoDaContinuacao; corpo?: string }) =>
      apiClient.post(
        `/api/v1/campaigns/${campanhaId}/continuacoes/${a.id}/${a.acao}`,
        a.corpo !== undefined ? { corpo: a.corpo } : {},
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chave }),
    onError: (e) => showApiError(e),
  });
  return { dados: consulta.data ?? null, carregando: consulta.isLoading, decidir };
}
