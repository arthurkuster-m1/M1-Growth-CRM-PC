"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type {
  ConfigDoCronograma,
  ItemDoCronograma,
  MetaDoCronograma,
  TarefaDoCronograma,
} from "@/lib/marketing/cronograma";

const BASE = "/api/v1/marketing/cronograma";

export interface DadosDoCronograma {
  config: ConfigDoCronograma;
  itens: ItemDoCronograma[];
  metas: MetaDoCronograma[];
  pode_editar: boolean;
}

export interface EventoDoHistorico {
  id: string;
  task_id: string;
  tipo: string;
  de_prazo: string | null;
  para_prazo: string | null;
  situacao: string | null;
  motivo: string | null;
  semana_inicio: string | null;
  created_at: string;
  crm_tasks: {
    title: string;
    cronograma_lado: string | null;
    prazo_original: string | null;
    adiamentos: number;
  } | null;
}

/** O cronograma geral (config, metas e ações) e a semana escolhida. Cada escrita espera o servidor. */
export function useCronograma(inicioDaSemana: string, ativarHistorico: boolean) {
  const qc = useQueryClient();
  const chaveGeral = ["cronograma"] as const;
  const chaveSemana = ["cronograma-semana", inicioDaSemana] as const;
  const chaveHistorico = ["cronograma-historico", inicioDaSemana] as const;

  const geral = useQuery({
    queryKey: chaveGeral,
    queryFn: async () => (await apiClient.get<{ data: DadosDoCronograma }>(BASE)).data,
    staleTime: 15_000,
  });
  const semana = useQuery({
    queryKey: chaveSemana,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { inicio: string; tarefas: TarefaDoCronograma[] } }>(
          `${BASE}/semana?inicio=${inicioDaSemana}`,
        )
      ).data.tarefas,
    staleTime: 10_000,
  });
  const historico = useQuery({
    queryKey: chaveHistorico,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { eventos: EventoDoHistorico[] } }>(
          `${BASE}/historico?inicio=${inicioDaSemana}`,
        )
      ).data.eventos,
    enabled: ativarHistorico,
    staleTime: 10_000,
  });

  const recarregarGeral = () => qc.invalidateQueries({ queryKey: chaveGeral });
  const recarregarSemana = async () => {
    await qc.invalidateQueries({ queryKey: ["cronograma-semana"] });
    await qc.invalidateQueries({ queryKey: ["cronograma-historico"] });
  };

  const executar = <T>(fn: () => Promise<T>, depois: () => Promise<unknown> | unknown) =>
    fn().then(
      async (r) => {
        await depois();
        return r;
      },
      (e) => {
        showApiError(e);
        return null;
      },
    );

  return {
    dados: geral.data,
    carregando: geral.isLoading,
    falhou: geral.isError,
    tarefas: semana.data ?? [],
    carregandoSemana: semana.isLoading,
    historico: historico.data ?? [],
    salvarConfig: (c: ConfigDoCronograma) =>
      executar(() => apiClient.put(BASE, c), recarregarGeral),
    criarItem: (i: Omit<ItemDoCronograma, "id" | "ordem">) =>
      executar(() => apiClient.post(`${BASE}/itens`, i), recarregarGeral),
    editarItem: (id: string, i: Partial<Omit<ItemDoCronograma, "id" | "ordem">>) =>
      executar(() => apiClient.patch(`${BASE}/itens/${id}`, i), recarregarGeral),
    apagarItem: (id: string) =>
      executar(() => apiClient.delete(`${BASE}/itens/${id}`), recarregarGeral),
    criarMeta: (m: Pick<MetaDoCronograma, "titulo" | "alvo" | "atual" | "descricao">) =>
      executar(() => apiClient.post(`${BASE}/metas`, m), recarregarGeral),
    editarMeta: (
      id: string,
      m: Partial<Pick<MetaDoCronograma, "titulo" | "alvo" | "atual" | "descricao">>,
    ) => executar(() => apiClient.patch(`${BASE}/metas/${id}`, m), recarregarGeral),
    apagarMeta: (id: string) =>
      executar(() => apiClient.delete(`${BASE}/metas/${id}`), recarregarGeral),
    adicionarTarefa: (t: {
      id?: string;
      title?: string;
      due_date?: string | null;
      lado: "agencia" | "cliente";
    }) => executar(() => apiClient.post(`${BASE}/tarefas`, t), recarregarSemana),
    editarTarefa: (
      id: string,
      t: {
        lado?: "agencia" | "cliente" | null;
        due_date?: string | null;
        status?: string;
        motivo?: string;
      },
    ) => executar(() => apiClient.patch(`${BASE}/tarefas/${id}`, t), recarregarSemana),
    fecharSemana: (
      decisoes: Array<{
        task_id: string;
        acao: "concluir" | "adiar" | "manter" | "cancelar";
        novo_prazo?: string | null;
        motivo?: string;
      }>,
    ) =>
      executar(
        () => apiClient.post(`${BASE}/fechar-semana`, { inicio: inicioDaSemana, decisoes }),
        recarregarSemana,
      ),
    disponiveis: async (q: string) =>
      (
        await apiClient.get<{
          data: { tarefas: Array<{ id: string; title: string; due_date: string | null }> };
        }>(`${BASE}/disponiveis?q=${encodeURIComponent(q)}`)
      ).data.tarefas,
  };
}

/** Baixar o painel como imagem (o "print" para mandar ao cliente). */
export function useBaixarImagem() {
  return useMutation({
    mutationFn: async ({ elemento, nome }: { elemento: HTMLElement; nome: string }) => {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(elemento, {
        backgroundColor: "#0a0b0f",
        scale: 2,
        useCORS: true,
      });
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("sem imagem");
      const arquivo = new File([blob], nome, { type: "image/png" });
      if (navigator.canShare?.({ files: [arquivo] })) {
        try {
          await navigator.share({ files: [arquivo], title: nome });
          return;
        } catch {
          /* cancelou o compartilhamento: cai no download */
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: showApiError,
  });
}
