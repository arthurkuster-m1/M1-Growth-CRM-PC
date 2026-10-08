"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import { lacunaAcabou, posicaoEntre, renumerar } from "@/lib/motor/ordem";
import type { MudancasEmMassa } from "@/lib/tarefas/edicao-em-massa";
import type { EdicaoDaTarefa, NovaTarefa, Tarefa } from "@/lib/tarefas/tipos";

const BASE = "/api/v1/tasks";
/** Prefixo `crm_tasks`: invalidar `["crm_tasks"]` atualiza esta tela E a de Tarefas atual. */
const CHAVE = ["crm_tasks", "motor"] as const;

const posicaoDe = (t: Tarefa) => t.position ?? 0;

/**
 * As tarefas da tabela estilo Notion.
 *
 * Diferente de `useTasks`, as edições são OTIMISTAS: a célula muda no mesmo instante e o
 * servidor confirma depois. Numa tabela em que cada clique é uma edição, esperar os
 * 400–800 ms de uma ida ao banco por célula faria cada gesto parecer travado. Se a rota
 * recusa, o estado anterior volta e o erro aparece.
 *
 * Traz TODAS as situações (inclusive concluídas), em ordem manual: filtrar é decisão da
 * visualização, não do hook.
 */
export function useTarefasDoMotor() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { tasks: Tarefa[] } }>(BASE);
      return r.data.tasks;
    },
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const tarefas = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => posicaoDe(a) - posicaoDe(b)),
    [query.data],
  );

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["crm_tasks"] });

  const editar = useMutation({
    mutationFn: ({ id, enviar }: { id: string; enviar: EdicaoDaTarefa; local?: Partial<Tarefa> }) =>
      apiClient.patch<{ data: { task: Tarefa } }>(`${BASE}/${id}`, enviar),
    onMutate: async ({ id, enviar, local }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const antes = queryClient.getQueryData<Tarefa[]>(CHAVE);
      queryClient.setQueryData<Tarefa[]>(CHAVE, (lista) =>
        (lista ?? []).map((t) => (t.id === id ? ({ ...t, ...enviar, ...local } as Tarefa) : t)),
      );
      return { antes };
    },
    onError: (err, _vars, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(CHAVE, contexto.antes);
      showApiError(err);
    },
    onSettled: invalidar,
  });

  const criar = useMutation({
    mutationFn: (entrada: NovaTarefa) =>
      apiClient.post<{ data: { task: Tarefa } }>(BASE, entrada).then((r) => r.data.task),
    onSuccess: (tarefa) => {
      queryClient.setQueryData<Tarefa[]>(CHAVE, (lista) => [...(lista ?? []), tarefa]);
      void invalidar();
    },
    onError: showApiError,
  });

  const apagar = useMutation({
    mutationFn: (id: string) => apiClient.delete<{ data: { deleted: boolean } }>(`${BASE}/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const antes = queryClient.getQueryData<Tarefa[]>(CHAVE);
      queryClient.setQueryData<Tarefa[]>(CHAVE, (lista) =>
        (lista ?? []).filter((t) => t.id !== id),
      );
      return { antes };
    },
    onError: (err, _id, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(CHAVE, contexto.antes);
      showApiError(err);
    },
    onSettled: invalidar,
  });

  /**
   * Muda várias tarefas de uma vez (UMA requisição). Otimista como a edição individual: a
   * tabela mostra o resultado na hora, e volta ao que era se o servidor recusa.
   */
  const emMassa = useMutation({
    mutationFn: ({
      ids,
      mudancas,
    }: {
      ids: string[];
      mudancas: MudancasEmMassa;
      local?: Partial<Tarefa>;
    }) =>
      apiClient.patch<{ data: { updated: number } }>(`${BASE}/bulk`, { ids, changes: mudancas }),
    onMutate: async ({ ids, mudancas, local }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const antes = queryClient.getQueryData<Tarefa[]>(CHAVE);
      const alvo = new Set(ids);
      queryClient.setQueryData<Tarefa[]>(CHAVE, (lista) =>
        (lista ?? []).map((t) =>
          alvo.has(t.id) ? ({ ...t, ...mudancas, ...local } as Tarefa) : t,
        ),
      );
      return { antes };
    },
    onError: (err, _vars, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(CHAVE, contexto.antes);
      showApiError(err);
    },
    onSettled: invalidar,
  });

  const apagarVarias = useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.delete<{ data: { deleted: number } }>(`${BASE}/bulk`, { ids }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const antes = queryClient.getQueryData<Tarefa[]>(CHAVE);
      const alvo = new Set(ids);
      queryClient.setQueryData<Tarefa[]>(CHAVE, (lista) =>
        (lista ?? []).filter((t) => !alvo.has(t.id)),
      );
      return { antes };
    },
    onError: (err, _ids, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(CHAVE, contexto.antes);
      showApiError(err);
    },
    onSettled: invalidar,
  });

  /** `local` é o que a tela já mostra enquanto o servidor não responde (ex.: o grupo da opção). */
  const editarTarefa = useCallback(
    (id: string, enviar: EdicaoDaTarefa, local?: Partial<Tarefa>) =>
      editar.mutateAsync({ id, enviar, local }).catch(() => undefined),
    [editar],
  );

  /**
   * Leva `id` para o índice `destino` da lista (já sem ele) e grava a posição nova.
   *
   * Uma coluna de uma linha, na maior parte das vezes. Só quando as vizinhas ficaram
   * coladas demais para caber um ponto médio é que a lista inteira é renumerada.
   */
  const reordenar = useCallback(
    async (id: string, destino: number) => {
      const semEla = tarefas.filter((t) => t.id !== id);
      const anterior = semEla[destino - 1];
      const proximo = semEla[destino];
      if (lacunaAcabou(anterior && posicaoDe(anterior), proximo && posicaoDe(proximo))) {
        const ordem = [
          ...semEla.slice(0, destino),
          tarefas.find((t) => t.id === id)!,
          ...semEla.slice(destino),
        ];
        const novas = renumerar(ordem.map(posicaoDe));
        await Promise.all(
          ordem.map((t, i) => editarTarefa(t.id, { position: novas[i]! }, { position: novas[i]! })),
        );
        return;
      }
      const position = posicaoEntre(anterior && posicaoDe(anterior), proximo && posicaoDe(proximo));
      await editarTarefa(id, { position }, { position });
    },
    [tarefas, editarTarefa],
  );

  return {
    tarefas,
    carregando: query.isLoading,
    falhou: query.isError,
    editarTarefa,
    reordenar,
    criarTarefa: (entrada: NovaTarefa) => criar.mutateAsync(entrada),
    editarVarias: (ids: string[], mudancas: MudancasEmMassa, local?: Partial<Tarefa>) =>
      emMassa.mutateAsync({ ids, mudancas, local }).catch(() => undefined),
    apagarVarias: (ids: string[]) => apagarVarias.mutateAsync(ids).catch(() => undefined),
    apagarTarefa: (id: string) => apagar.mutateAsync(id).catch(() => undefined),
  };
}
