"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { EntradaDeModelo, ModeloDeTarefa } from "@/lib/tarefas/modelos";

const BASE = "/api/v1/tasks/templates";
const CHAVE = ["task-templates"] as const;

/**
 * Os modelos de tarefa da organização (e as repetições, que moram neles).
 *
 * Criar, editar e apagar esperam o servidor — é a tela de configuração, não a tabela, e a
 * próxima ocorrência da repetição só o servidor sabe calcular. Cada uma devolve o modelo
 * salvo (ou `undefined` se o servidor recusou; o erro já foi mostrado).
 */
export function useModelosDeTarefa() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { templates: ModeloDeTarefa[] } }>(BASE);
      return r.data.templates;
    },
    staleTime: 30_000,
  });

  const criar = useMutation({
    mutationFn: (entrada: EntradaDeModelo) =>
      apiClient
        .post<{ data: { template: ModeloDeTarefa } }>(BASE, entrada)
        .then((r) => r.data.template),
    onSuccess: (modelo) =>
      queryClient.setQueryData<ModeloDeTarefa[]>(CHAVE, (lista) => [...(lista ?? []), modelo]),
    onError: showApiError,
  });

  const editar = useMutation({
    mutationFn: ({ id, entrada }: { id: string; entrada: EntradaDeModelo }) =>
      apiClient
        .patch<{ data: { template: ModeloDeTarefa } }>(`${BASE}/${id}`, entrada)
        .then((r) => r.data.template),
    onSuccess: (modelo) =>
      queryClient.setQueryData<ModeloDeTarefa[]>(CHAVE, (lista) =>
        (lista ?? []).map((m) => (m.id === modelo.id ? modelo : m)),
      ),
    onError: showApiError,
  });

  const apagar = useMutation({
    mutationFn: (id: string) => apiClient.delete<{ data: { deleted: boolean } }>(`${BASE}/${id}`),
    onSuccess: (_r, id) =>
      queryClient.setQueryData<ModeloDeTarefa[]>(CHAVE, (lista) =>
        (lista ?? []).filter((m) => m.id !== id),
      ),
    onError: showApiError,
  });

  return {
    modelos: query.data ?? [],
    carregando: query.isLoading,
    criarModelo: (entrada: EntradaDeModelo) => criar.mutateAsync(entrada).catch(() => undefined),
    editarModelo: (id: string, entrada: EntradaDeModelo) =>
      editar.mutateAsync({ id, entrada }).catch(() => undefined),
    apagarModelo: (id: string) =>
      apagar
        .mutateAsync(id)
        .then(() => true)
        .catch(() => false),
  };
}
