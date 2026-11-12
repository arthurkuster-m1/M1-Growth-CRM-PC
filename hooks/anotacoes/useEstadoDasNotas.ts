"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";

const CHAVE = ["anotacoes", "estado"] as const;

interface Estado {
  favoritas: string[];
  recentes: string[];
}

/** O que é só DESTA pessoa: as páginas favoritas e as abertas há pouco. */
export function useEstadoDasNotas() {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const r = await apiClient.get<{ data: Estado }>("/api/v1/anotacoes/estado");
      return r.data;
    },
    staleTime: 30_000,
  });

  const favoritar = useCallback(
    async (id: string, favorita: boolean) => {
      const antes = queryClient.getQueryData<Estado>(CHAVE);
      queryClient.setQueryData<Estado>(CHAVE, (e) =>
        e
          ? {
              ...e,
              favoritas: favorita
                ? [...e.favoritas.filter((x) => x !== id), id]
                : e.favoritas.filter((x) => x !== id),
            }
          : e,
      );
      try {
        await apiClient.put(`/api/v1/anotacoes/${id}/estado`, { favorite: favorita });
      } catch (erro) {
        queryClient.setQueryData(CHAVE, antes);
        showApiError(erro);
      }
    },
    [queryClient],
  );

  /** Anota que a página foi aberta agora (a lista de recentes sobe na hora; o servidor guarda em silêncio). */
  const registrarAbertura = useCallback(
    (id: string) => {
      queryClient.setQueryData<Estado>(CHAVE, (e) =>
        e ? { ...e, recentes: [id, ...e.recentes.filter((x) => x !== id)].slice(0, 8) } : e,
      );
      void apiClient.put(`/api/v1/anotacoes/${id}/estado`, { opened: true }).catch(() => undefined);
    },
    [queryClient],
  );

  return {
    favoritas: consulta.data?.favoritas ?? [],
    recentes: consulta.data?.recentes ?? [],
    favoritar,
    registrarAbertura,
  };
}
