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

  return {
    subpaginas: consulta.data?.subpaginas ?? [],
    podeEditar: consulta.data?.pode_editar ?? false,
    carregando: consulta.isLoading,
    criarSubpagina: (entrada: { tipo: string; title: string }) =>
      criar.mutateAsync(entrada).catch(() => null),
  };
}
