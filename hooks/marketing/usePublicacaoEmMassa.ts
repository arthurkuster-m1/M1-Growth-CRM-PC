"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { PaginaParaPublicar } from "@/lib/marketing/paginas";

/** Todas as páginas da empresa com o estado de publicação (só a agência), e a ação em massa. */
export function usePublicacaoEmMassa(ativo: boolean) {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: ["marketing-publicacao-em-massa"],
    queryFn: async () => {
      const r = await apiClient.get<{ data: { paginas: PaginaParaPublicar[] } }>(
        "/api/v1/marketing/pages/todas",
      );
      return r.data.paginas;
    },
    enabled: ativo,
    staleTime: 10_000,
    retry: false,
  });

  const acao = useMutation({
    mutationFn: (entrada: { keys: string[]; acao: "publicar" | "despublicar" }) =>
      apiClient
        .post<{ data: { feitas: number; ignoradas: number } }>(
          "/api/v1/marketing/pages/publicacao",
          entrada,
        )
        .then((r) => r.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["marketing-publicacao-em-massa"] });
      // As telas de cada página e as listas de subpáginas passam a mostrar o novo estado.
      await queryClient.invalidateQueries({ queryKey: ["marketing-page"] });
      await queryClient.invalidateQueries({ queryKey: ["marketing-subpaginas"] });
    },
    onError: showApiError,
  });

  return {
    paginas: consulta.data ?? [],
    carregando: consulta.isLoading,
    negado: consulta.isError,
    executar: (keys: string[], tipo: "publicar" | "despublicar") =>
      acao.mutateAsync({ keys, acao: tipo }).catch(() => null),
    ocupado: acao.isPending,
  };
}
