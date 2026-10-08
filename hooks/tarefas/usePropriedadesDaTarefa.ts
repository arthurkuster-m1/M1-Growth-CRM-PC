"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type {
  OpcaoDePropriedade,
  PropriedadeDaTarefa,
  TipoDePropriedade,
} from "@/lib/tarefas/propriedades";

const BASE = "/api/v1/tasks/properties";
const CHAVE = ["crm_task_properties"] as const;

export interface NovaPropriedadeEntrada {
  name: string;
  type: TipoDePropriedade;
  options?: OpcaoDePropriedade[];
}

export interface EdicaoDaPropriedade {
  name?: string;
  options?: OpcaoDePropriedade[];
  position?: number;
}

/**
 * As propriedades personalizadas das tarefas, com as três mutações do menu da coluna.
 *
 * Renomear e mexer nas opções é OTIMISTA (a tela muda na hora; se a rota recusa, volta);
 * criar espera a resposta — a coluna nova precisa do id que o servidor gerou. Apagar
 * invalida também as tarefas: a rota leva os valores da propriedade embora.
 */
export function usePropriedadesDaTarefa() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { properties: PropriedadeDaTarefa[] } }>(BASE);
      return r.data.properties;
    },
    staleTime: 60_000,
  });

  const propriedades = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => a.position - b.position),
    [query.data],
  );

  const criar = useMutation({
    mutationFn: (entrada: NovaPropriedadeEntrada) =>
      apiClient
        .post<{ data: { property: PropriedadeDaTarefa } }>(BASE, entrada)
        .then((r) => r.data.property),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
    onError: showApiError,
  });

  const editar = useMutation({
    mutationFn: ({ id, entrada }: { id: string; entrada: EdicaoDaPropriedade }) =>
      apiClient.patch<{ data: { property: PropriedadeDaTarefa } }>(`${BASE}/${id}`, entrada),
    onMutate: async ({ id, entrada }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const antes = queryClient.getQueryData<PropriedadeDaTarefa[]>(CHAVE);
      queryClient.setQueryData<PropriedadeDaTarefa[]>(CHAVE, (lista) =>
        (lista ?? []).map((p) => (p.id === id ? { ...p, ...entrada } : p)),
      );
      return { antes };
    },
    onError: (err, _vars, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(CHAVE, contexto.antes);
      showApiError(err);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
  });

  const apagar = useMutation({
    mutationFn: (id: string) => apiClient.delete<{ data: { deleted: boolean } }>(`${BASE}/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const antes = queryClient.getQueryData<PropriedadeDaTarefa[]>(CHAVE);
      queryClient.setQueryData<PropriedadeDaTarefa[]>(CHAVE, (lista) =>
        (lista ?? []).filter((p) => p.id !== id),
      );
      return { antes };
    },
    onError: (err, _id, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(CHAVE, contexto.antes);
      showApiError(err);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CHAVE });
      void queryClient.invalidateQueries({ queryKey: ["crm_tasks"] });
    },
  });

  return {
    propriedades,
    criarPropriedade: (entrada: NovaPropriedadeEntrada) => criar.mutateAsync(entrada),
    editarPropriedade: (id: string, entrada: EdicaoDaPropriedade) =>
      editar.mutateAsync({ id, entrada }).catch(() => undefined),
    apagarPropriedade: (id: string) => apagar.mutateAsync(id).catch(() => undefined),
  };
}
