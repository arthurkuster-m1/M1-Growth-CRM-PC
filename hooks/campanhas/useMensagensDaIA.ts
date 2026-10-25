"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { RevisaoDasMensagens } from "@/lib/campanhas/mensagens-da-ia";

/** As mensagens que a IA escreve para os leads do disparo, e a aprovação delas. */
export function useMensagensDaIA(campanhaId: string, ativo: boolean) {
  const qc = useQueryClient();
  const chave = ["mensagens-da-ia", campanhaId] as const;
  const base = `/api/v1/campaigns/${campanhaId}/mensagens-da-ia`;
  const consulta = useQuery({
    queryKey: chave,
    enabled: ativo,
    queryFn: async () => (await apiClient.get<{ data: RevisaoDasMensagens }>(base)).data,
    staleTime: 5_000,
  });
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: chave });
    void qc.invalidateQueries({ queryKey: ["campanha", campanhaId] });
  };
  const gerar = useMutation({
    mutationFn: async (recipientId?: string) =>
      (
        await apiClient.post<{ data: { geradas: number; falhas: number; custo_cents: number } }>(
          `${base}/gerar`,
          recipientId ? { recipient_id: recipientId } : {},
        )
      ).data,
    onSuccess: recarregar,
    onError: (e) => showApiError(e),
  });
  const editar = useMutation({
    mutationFn: async (a: { id: string; corpo?: string; excluir?: true }) =>
      apiClient.patch(`${base}/${a.id}`, a.excluir ? { excluir: true } : { corpo: a.corpo }),
    onSuccess: recarregar,
    onError: (e) => showApiError(e),
  });
  const aprovar = useMutation({
    mutationFn: async () => apiClient.post(`${base}/aprovar`, {}),
    onSuccess: recarregar,
    onError: (e) => showApiError(e),
  });
  return { revisao: consulta.data ?? null, carregando: consulta.isLoading, gerar, editar, aprovar };
}
