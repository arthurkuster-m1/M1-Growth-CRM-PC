"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { ResumoDeSubpagina } from "@/lib/marketing/paginas";

/** As subpáginas de um módulo (a agência vê todas; o cliente, só as publicadas). */
export function useSubpaginasDeMarketing(modulo: string) {
  const queryClient = useQueryClient();
  const chave = ["marketing-subpaginas", modulo] as const;

  const consulta = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const r = await apiClient.get<{
        data: { subpaginas: ResumoDeSubpagina[]; pode_editar: boolean };
      }>(`/api/v1/marketing/pages?modulo=${modulo}`);
      return r.data;
    },
    staleTime: 15_000,
  });

  const criar = useMutation({
    mutationFn: (entrada: { tipo: string; title: string }) =>
      apiClient
        .post<{ data: { key: string } }>("/api/v1/marketing/pages", { modulo, ...entrada })
        .then((r) => r.data.key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chave }),
    onError: showApiError,
  });

  /** Move uma subpágina uma posição (otimista; volta atrás se o servidor recusar). */
  const reordenar = useMutation({
    mutationFn: (keys: string[]) =>
      apiClient.put("/api/v1/marketing/pages/ordem", { modulo, keys }),
    onMutate: async (keys: string[]) => {
      await queryClient.cancelQueries({ queryKey: chave });
      const antes = queryClient.getQueryData<{
        subpaginas: ResumoDeSubpagina[];
        pode_editar: boolean;
      }>(chave);
      if (antes) {
        const porChave = new Map(antes.subpaginas.map((s) => [s.key, s]));
        queryClient.setQueryData(chave, {
          ...antes,
          subpaginas: keys.map((k) => porChave.get(k)).filter((s): s is ResumoDeSubpagina => !!s),
        });
      }
      return { antes };
    },
    onError: (erro, _keys, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(chave, contexto.antes);
      showApiError(erro);
    },
  });

  return {
    moverSubpagina: (key: string, delta: -1 | 1) => {
      const lista = consulta.data?.subpaginas ?? [];
      const i = lista.findIndex((s) => s.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= lista.length) return;
      const keys = lista.map((s) => s.key);
      [keys[i], keys[j]] = [keys[j]!, keys[i]!];
      reordenar.mutate(keys);
    },
    subpaginas: consulta.data?.subpaginas ?? [],
    podeEditar: consulta.data?.pode_editar ?? false,
    carregando: consulta.isLoading,
    criarSubpagina: (entrada: { tipo: string; title: string }) =>
      criar.mutateAsync(entrada).catch(() => null),
  };
}
