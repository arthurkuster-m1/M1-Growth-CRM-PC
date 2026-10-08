"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { CorDaOpcao, OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import type { SituacaoDaTarefa } from "@/lib/tarefas/tipos";

const BASE = "/api/v1/tasks/status-options";
const CHAVE = ["crm_task_status_options"] as const;

export interface NovaOpcao {
  name: string;
  color?: CorDaOpcao;
  grupo?: SituacaoDaTarefa;
}

export interface EdicaoDaOpcao {
  name?: string;
  color?: CorDaOpcao;
  grupo?: SituacaoDaTarefa;
  position?: number;
}

/**
 * As opções de status das tarefas da organização, com as três mutações do editor.
 *
 * Mexer numa opção pode mudar tarefas (trocar o grupo move quem a usa; apagar devolve
 * quem a usava à primeira opção do grupo), então toda mutação invalida TAMBÉM a lista
 * de tarefas — a chave `["crm_tasks"]` cobre as duas telas de Tarefas.
 */
export function useOpcoesDeStatus() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { options: OpcaoDeStatus[] } }>(BASE);
      return r.data.options;
    },
    staleTime: 60_000,
  });

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: CHAVE });
    void queryClient.invalidateQueries({ queryKey: ["crm_tasks"] });
  };

  const criar = useMutation({
    mutationFn: (entrada: NovaOpcao) =>
      apiClient.post<{ data: { option: OpcaoDeStatus } }>(BASE, entrada),
    onSuccess: invalidar,
    onError: showApiError,
  });

  const editar = useMutation({
    mutationFn: ({ id, entrada }: { id: string; entrada: EdicaoDaOpcao }) =>
      apiClient.patch<{ data: { option: OpcaoDeStatus } }>(`${BASE}/${id}`, entrada),
    onSuccess: invalidar,
    onError: showApiError,
  });

  const apagar = useMutation({
    mutationFn: (id: string) => apiClient.delete<{ data: { deleted: boolean } }>(`${BASE}/${id}`),
    onSuccess: invalidar,
    onError: showApiError,
  });

  return {
    opcoes: query.data ?? [],
    carregando: query.isLoading,
    criarOpcao: (entrada: NovaOpcao) => criar.mutateAsync(entrada),
    editarOpcao: (id: string, entrada: EdicaoDaOpcao) => editar.mutateAsync({ id, entrada }),
    apagarOpcao: (id: string) => apagar.mutateAsync(id),
  };
}
