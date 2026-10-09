"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { PreferenciasDaTabela } from "@/lib/motor/layout";
import type { TipoDeVisualizacao, VisaoSalva } from "@/lib/motor/visualizacoes";

const BASE = "/api/v1/saved-views";
/** Mexer em filtro, ordem ou coluna dispara várias mudanças seguidas: grava uma vez, depois da pausa. */
const ESPERA_PARA_SALVAR_MS = 700;

/**
 * As visualizações salvas (as abas) de uma tela — da ORGANIZAÇÃO, iguais para todos.
 *
 * Criar, renomear e apagar esperam o servidor. Já a CONFIGURAÇÃO da aba (filtros, ordem,
 * colunas) muda na hora, no cache, e é gravada depois de uma pausa — a mesma ideia do
 * layout pessoal. Quem só pode ver (`podeEditar` falso) mexe só na própria tela: nada é
 * enviado, e ao recarregar a aba volta ao que está salvo.
 */
export function useVisoesSalvas(tela: string, podeEditar: boolean) {
  const queryClient = useQueryClient();
  const chave = ["saved-views", tela] as const;

  const query = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { views: VisaoSalva[] } }>(
        `${BASE}?screen=${encodeURIComponent(tela)}`,
      );
      return r.data.views;
    },
    staleTime: 30_000,
  });
  const visoes = query.data ?? [];

  const pendentes = useRef(new Map<string, PreferenciasDaTabela>());
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const enviarPendentes = useCallback(async () => {
    const lote = [...pendentes.current.entries()];
    pendentes.current.clear();
    await Promise.all(
      lote.map(([id, config]) =>
        apiClient.patch(`${BASE}/${id}`, { config }).catch((erro) => showApiError(erro)),
      ),
    );
  }, []);

  // Saiu da tela com gravação pendente: envia agora.
  useEffect(
    () => () => {
      if (temporizador.current) {
        clearTimeout(temporizador.current);
        void enviarPendentes();
      }
    },
    [enviarPendentes],
  );

  const salvarConfig = useCallback(
    (id: string, config: PreferenciasDaTabela) => {
      queryClient.setQueryData<VisaoSalva[]>(chave, (lista) =>
        (lista ?? []).map((v) => (v.id === id ? { ...v, config } : v)),
      );
      if (!podeEditar) return;
      pendentes.current.set(id, config);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        temporizador.current = undefined;
        void enviarPendentes();
      }, ESPERA_PARA_SALVAR_MS);
    },
    // `chave` é recriada a cada render com o mesmo conteúdo; a identidade que importa é a da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, tela, podeEditar, enviarPendentes],
  );

  const criar = useMutation({
    mutationFn: (entrada: {
      name: string;
      type: TipoDeVisualizacao;
      config?: PreferenciasDaTabela;
    }) =>
      apiClient
        .post<{ data: { view: VisaoSalva } }>(BASE, { screen_key: tela, ...entrada })
        .then((r) => r.data.view),
    onSuccess: (visao) =>
      queryClient.setQueryData<VisaoSalva[]>(chave, (lista) => [...(lista ?? []), visao]),
    onError: showApiError,
  });

  const editar = useMutation({
    mutationFn: ({ id, ...mudancas }: { id: string; name?: string; type?: TipoDeVisualizacao }) =>
      apiClient
        .patch<{ data: { view: VisaoSalva } }>(`${BASE}/${id}`, mudancas)
        .then((r) => r.data.view),
    onMutate: async ({ id, ...mudancas }) => {
      await queryClient.cancelQueries({ queryKey: chave });
      const antes = queryClient.getQueryData<VisaoSalva[]>(chave);
      queryClient.setQueryData<VisaoSalva[]>(chave, (lista) =>
        (lista ?? []).map((v) => (v.id === id ? { ...v, ...mudancas } : v)),
      );
      return { antes };
    },
    onError: (erro, _vars, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(chave, contexto.antes);
      showApiError(erro);
    },
  });

  const apagar = useMutation({
    mutationFn: (id: string) => apiClient.delete<{ data: { deleted: boolean } }>(`${BASE}/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: chave });
      const antes = queryClient.getQueryData<VisaoSalva[]>(chave);
      pendentes.current.delete(id);
      queryClient.setQueryData<VisaoSalva[]>(chave, (lista) =>
        (lista ?? []).filter((v) => v.id !== id),
      );
      return { antes };
    },
    onError: (erro, _id, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(chave, contexto.antes);
      showApiError(erro);
    },
  });

  return {
    visoes,
    carregando: query.isLoading,
    salvarConfig,
    criarVisao: (entrada: {
      name: string;
      type: TipoDeVisualizacao;
      config?: PreferenciasDaTabela;
    }) => criar.mutateAsync(entrada).catch(() => undefined),
    editarVisao: (id: string, mudancas: { name?: string; type?: TipoDeVisualizacao }) =>
      editar.mutateAsync({ id, ...mudancas }).catch(() => undefined),
    apagarVisao: (id: string) => apagar.mutateAsync(id).catch(() => undefined),
  };
}
