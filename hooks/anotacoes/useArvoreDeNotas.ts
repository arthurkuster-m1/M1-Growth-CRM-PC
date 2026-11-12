"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import { idsDaSubarvore, type ResumoDaNota } from "@/lib/anotacoes/paginas";

const CHAVE = ["anotacoes", "arvore"] as const;

interface Lista {
  pages: ResumoDaNota[];
  pode_editar: boolean;
}

/** O que dá para mudar numa página sem mexer no conteúdo: tudo otimista, com volta se falhar. */
export type MudancaNaArvore = Partial<
  Pick<ResumoDaNota, "title" | "icon" | "parent_id" | "position" | "visible_to_client">
>;

/**
 * A ÁRVORE de anotações: a lista leve de páginas (sem conteúdo) e as ações sobre ela.
 * Edição otimista (`setQueryData` + volta se o servidor recusar), como no resto do motor.
 */
export function useArvoreDeNotas() {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const r = await apiClient.get<{ data: Lista }>("/api/v1/anotacoes");
      return r.data;
    },
    staleTime: 15_000,
  });

  const notas = consulta.data?.pages ?? [];

  const trocarNaLista = useCallback(
    (fn: (atual: ResumoDaNota[]) => ResumoDaNota[]) =>
      queryClient.setQueryData<Lista>(CHAVE, (l) => (l ? { ...l, pages: fn(l.pages) } : l)),
    [queryClient],
  );

  /** Aplica a mudança na hora e a manda ao servidor; se falhar, devolve a lista como estava. */
  const mudar = useCallback(
    async (
      id: string,
      mudanca: MudancaNaArvore,
      opcoes: { cascade?: boolean } = {},
    ): Promise<boolean> => {
      const antes = queryClient.getQueryData<Lista>(CHAVE);
      const alvo =
        opcoes.cascade && mudanca.visible_to_client !== undefined && antes
          ? new Set(idsDaSubarvore(antes.pages, id))
          : new Set([id]);
      trocarNaLista((l) => l.map((n) => (alvo.has(n.id) ? { ...n, ...mudanca } : n)));
      try {
        await apiClient.patch(`/api/v1/anotacoes/${id}`, {
          ...mudanca,
          ...(opcoes.cascade ? { cascade: true } : {}),
        });
        return true;
      } catch (erro) {
        queryClient.setQueryData(CHAVE, antes);
        showApiError(erro);
        return false;
      }
    },
    [queryClient, trocarNaLista],
  );

  const criar = useCallback(
    async (parentId: string | null, title = ""): Promise<ResumoDaNota | null> => {
      try {
        const r = await apiClient.post<{ data: { page: ResumoDaNota } }>("/api/v1/anotacoes", {
          parent_id: parentId,
          title,
        });
        trocarNaLista((l) => [...l, r.data.page]);
        return r.data.page;
      } catch (erro) {
        showApiError(erro);
        return null;
      }
    },
    [trocarNaLista],
  );

  /** Manda para a lixeira (a página e tudo que está dentro dela). */
  const apagar = useCallback(
    async (id: string): Promise<boolean> => {
      const antes = queryClient.getQueryData<Lista>(CHAVE);
      const alvo = new Set(antes ? idsDaSubarvore(antes.pages, id) : [id]);
      const agora = new Date().toISOString();
      trocarNaLista((l) =>
        l.map((n) => (alvo.has(n.id) && !n.deleted_at ? { ...n, deleted_at: agora } : n)),
      );
      try {
        await apiClient.delete(`/api/v1/anotacoes/${id}`);
        return true;
      } catch (erro) {
        queryClient.setQueryData(CHAVE, antes);
        showApiError(erro);
        return false;
      }
    },
    [queryClient, trocarNaLista],
  );

  const restaurar = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await apiClient.post(`/api/v1/anotacoes/${id}/restaurar`, {});
        await queryClient.invalidateQueries({ queryKey: CHAVE });
        return true;
      } catch (erro) {
        showApiError(erro);
        return false;
      }
    },
    [queryClient],
  );

  const apagarDeVez = useCallback(
    async (id: string): Promise<boolean> => {
      const antes = queryClient.getQueryData<Lista>(CHAVE);
      const alvo = new Set(antes ? idsDaSubarvore(antes.pages, id) : [id]);
      trocarNaLista((l) => l.filter((n) => !alvo.has(n.id)));
      try {
        await apiClient.delete(`/api/v1/anotacoes/${id}?definitivo=1`);
        return true;
      } catch (erro) {
        queryClient.setQueryData(CHAVE, antes);
        showApiError(erro);
        return false;
      }
    },
    [queryClient, trocarNaLista],
  );

  return {
    notas,
    podeEditar: consulta.data?.pode_editar ?? false,
    carregando: consulta.isLoading,
    falhou: consulta.isError,
    mudar,
    criar,
    apagar,
    restaurar,
    apagarDeVez,
    trocarNaLista,
  };
}
