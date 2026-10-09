"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { LinkDeMarketing } from "@/lib/marketing/links";

const BASE = "/api/v1/marketing/share-links";
const CHAVE = ["marketing-share-links"] as const;

/** Os links sem login da empresa (só a agência vê). Criar e revogar esperam o servidor. */
export function useLinksDeMarketing(ativo: boolean) {
  const queryClient = useQueryClient();

  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { links: LinkDeMarketing[] } }>(BASE);
      return r.data.links;
    },
    enabled: ativo,
    staleTime: 15_000,
  });

  const criar = useMutation({
    mutationFn: (entrada: { module_key: string | null; expires_in_days: number | null }) =>
      apiClient.post<{ data: { link: LinkDeMarketing } }>(BASE, entrada).then((r) => r.data.link),
    onSuccess: (link) =>
      queryClient.setQueryData<LinkDeMarketing[]>(CHAVE, (lista) => [link, ...(lista ?? [])]),
    onError: showApiError,
  });

  const revogar = useMutation({
    mutationFn: (id: string) => apiClient.delete<{ data: { revoked: boolean } }>(`${BASE}/${id}`),
    onSuccess: (_r, id) =>
      queryClient.setQueryData<LinkDeMarketing[]>(CHAVE, (lista) =>
        (lista ?? []).filter((l) => l.id !== id),
      ),
    onError: showApiError,
  });

  return {
    links: consulta.data ?? [],
    carregando: consulta.isLoading,
    criarLink: (entrada: { module_key: string | null; expires_in_days: number | null }) =>
      criar.mutateAsync(entrada).catch(() => undefined),
    revogarLink: (id: string) =>
      revogar
        .mutateAsync(id)
        .then(() => true)
        .catch(() => false),
  };
}
