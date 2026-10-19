"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import { registrarDesfazer, valoresAntes } from "@/lib/motor/desfazer";
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
/** A tarefa como o formulário de criar a entende — para "desapagar" com o Ctrl+Z. */
function comoNovaTarefa(t: Tarefa): NovaTarefa {
  return {
    title: t.title,
    description: t.description,
    due_date: t.due_date,
    start_date: t.start_date ?? null,
    priority: t.priority,
    status: t.status,
    lead_id: t.lead_id,
    contact_id: t.contact_id,
    assigned_to: t.assigned_to,
    status_option_id: t.status_option_id ?? null,
    position: t.position,
    custom_fields: t.custom_fields,
  };
}

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
      return { antes, anterior: antes?.find((t) => t.id === id) };
    },
    onError: (err, _vars, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(CHAVE, contexto.antes);
      showApiError(err);
    },
    // Ctrl+Z: volta os campos que esta edição mudou ao que eram antes.
    onSuccess: (_r, { id, enviar, local }, contexto) => {
      const anterior = contexto?.anterior;
      if (!anterior) return;
      registrarDesfazer({
        rotulo: anterior.title,
        desfazer: () =>
          editar.mutateAsync({
            id,
            enviar: valoresAntes(anterior, enviar) as EdicaoDaTarefa,
            local: valoresAntes(anterior, local ?? {}) as Partial<Tarefa>,
          }),
      });
    },
    onSettled: invalidar,
  });

  const criar = useMutation({
    mutationFn: (entrada: NovaTarefa) =>
      apiClient.post<{ data: { task: Tarefa } }>(BASE, entrada).then((r) => r.data.task),
    onSuccess: (tarefa) => {
      queryClient.setQueryData<Tarefa[]>(CHAVE, (lista) => [...(lista ?? []), tarefa]);
      void invalidar();
      // Ctrl+Z: a tarefa criada some de novo.
      registrarDesfazer({ rotulo: tarefa.title, desfazer: () => apagar.mutateAsync(tarefa.id) });
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
      return { antes, apagada: antes?.find((t) => t.id === id) };
    },
    onError: (err, _id, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(CHAVE, contexto.antes);
      showApiError(err);
    },
    // Ctrl+Z: a tarefa apagada volta (com um id novo, no mesmo lugar da lista).
    onSuccess: (_r, _id, contexto) => {
      const apagada = contexto?.apagada;
      if (!apagada) return;
      registrarDesfazer({ rotulo: apagada.title, desfazer: () => criar.mutateAsync(comoNovaTarefa(apagada)) });
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
      return { antes, anteriores: (antes ?? []).filter((t) => alvo.has(t.id)) };
    },
    onError: (err, _vars, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(CHAVE, contexto.antes);
      showApiError(err);
    },
    // Ctrl+Z: cada tarefa volta ao que era (os valores antigos podem diferir de uma para outra).
    onSuccess: (_r, { mudancas, local }, contexto) => {
      const anteriores = contexto?.anteriores ?? [];
      if (anteriores.length === 0) return;
      registrarDesfazer({
        rotulo: `${anteriores.length} ${anteriores.length === 1 ? "tarefa" : "tarefas"}`,
        desfazer: () =>
          Promise.all(
            anteriores.map((t) =>
              editar.mutateAsync({
                id: t.id,
                enviar: valoresAntes(t, mudancas as Record<string, unknown>) as EdicaoDaTarefa,
                local: valoresAntes(t, local ?? {}) as Partial<Tarefa>,
              }),
            ),
          ),
      });
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
      return { antes, apagadas: (antes ?? []).filter((t) => alvo.has(t.id)) };
    },
    onError: (err, _ids, contexto) => {
      if (contexto?.antes) queryClient.setQueryData(CHAVE, contexto.antes);
      showApiError(err);
    },
    // Ctrl+Z: as tarefas apagadas voltam.
    onSuccess: (_r, _ids, contexto) => {
      const apagadas = contexto?.apagadas ?? [];
      if (apagadas.length === 0) return;
      registrarDesfazer({
        rotulo: `${apagadas.length} ${apagadas.length === 1 ? "tarefa" : "tarefas"}`,
        desfazer: () => Promise.all(apagadas.map((t) => criar.mutateAsync(comoNovaTarefa(t)))),
      });
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
