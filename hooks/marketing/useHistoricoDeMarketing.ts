"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { VersaoDaPagina } from "@/lib/marketing/historico";

/** O histórico de uma página (retratos do publicado). Salvar e apagar esperam o servidor. */
export function useHistoricoDeMarketing(chave: string, ativo: boolean) {
  const queryClient = useQueryClient();
  const rota = `/api/v1/marketing/pages/${chave}/snapshots`;
  const chaveDaConsulta = ["marketing-snapshots", chave] as const;

  const consulta = useQuery({
    queryKey: chaveDaConsulta,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { versoes: VersaoDaPagina[] } }>(rota);
      return r.data.versoes;
    },
    enabled: ativo,
    staleTime: 15_000,
  });

  const salvar = useMutation({
    mutationFn: (note: string) =>
      apiClient
        .post<{ data: { versao: VersaoDaPagina } }>(rota, { note })
        .then((r) => r.data.versao),
    onSuccess: (versao) =>
      queryClient.setQueryData<VersaoDaPagina[]>(chaveDaConsulta, (l) => [versao, ...(l ?? [])]),
    onError: showApiError,
  });

  const apagar = useMutation({
    mutationFn: (id: string) => apiClient.delete(`${rota}/${id}`),
    onSuccess: (_r, id) =>
      queryClient.setQueryData<VersaoDaPagina[]>(chaveDaConsulta, (l) =>
        (l ?? []).filter((v) => v.id !== id),
      ),
    onError: showApiError,
  });

  return {
    versoes: consulta.data ?? [],
    carregando: consulta.isLoading,
    salvarRetrato: (note: string) =>
      salvar.mutateAsync(note).then(
        () => true,
        () => false,
      ),
    apagarRetrato: (id: string) =>
      apagar.mutateAsync(id).then(
        () => true,
        () => false,
      ),
  };
}
