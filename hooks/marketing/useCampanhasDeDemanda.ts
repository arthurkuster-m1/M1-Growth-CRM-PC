"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { CampanhaDeDemanda, NotaDaCampanha, TipoDeNota } from "@/lib/marketing/campanhas";

const BASE = "/api/v1/demand-campaigns";
const CHAVE = ["demand-campaigns"] as const;

export interface DadosDasCampanhas {
  campanhas: CampanhaDeDemanda[];
  funis: Array<{ id: string; name: string }>;
  pode_editar: boolean;
}

export type EdicaoDeCampanha = Partial<
  Omit<
    CampanhaDeDemanda,
    "id" | "position" | "created_at" | "ultima_analise" | "ultimo_planejamento"
  >
>;

/** As campanhas de demanda da empresa. Editar muda a tela na hora e desfaz se o servidor recusar. */
export function useCampanhasDeDemanda() {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async () => (await apiClient.get<{ data: DadosDasCampanhas }>(BASE)).data,
    staleTime: 15_000,
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: CHAVE });

  const criar = useMutation({
    mutationFn: async (entrada: EdicaoDeCampanha & { name: string }) =>
      (await apiClient.post<{ data: { campanha: CampanhaDeDemanda } }>(BASE, entrada)).data
        .campanha,
    onSuccess: recarregar,
    onError: showApiError,
  });

  async function editar(ids: string[], patch: EdicaoDeCampanha) {
    const antes = queryClient.getQueryData<DadosDasCampanhas>(CHAVE);
    queryClient.setQueryData<DadosDasCampanhas>(CHAVE, (d) =>
      d
        ? {
            ...d,
            campanhas: d.campanhas.map((c) => (ids.includes(c.id) ? { ...c, ...patch } : c)),
          }
        : d,
    );
    try {
      await Promise.all(ids.map((id) => apiClient.patch(`${BASE}/${id}`, patch)));
    } catch (e) {
      queryClient.setQueryData(CHAVE, antes);
      showApiError(e);
    } finally {
      void recarregar();
    }
  }

  async function apagar(ids: string[]) {
    try {
      await Promise.all(ids.map((id) => apiClient.delete(`${BASE}/${id}`)));
    } catch (e) {
      showApiError(e);
    } finally {
      void recarregar();
    }
  }

  return {
    campanhas: consulta.data?.campanhas ?? [],
    funis: consulta.data?.funis ?? [],
    podeEditar: consulta.data?.pode_editar ?? false,
    carregando: consulta.isLoading,
    falhou: consulta.isError,
    criar: (entrada: EdicaoDeCampanha & { name: string }) =>
      criar.mutateAsync(entrada).catch(() => undefined),
    editar,
    apagar,
  };
}

/** O diário de bordo de uma campanha. */
export function useNotasDaCampanha(campanhaId: string) {
  const queryClient = useQueryClient();
  const chave = ["demand-campaign-notes", campanhaId] as const;
  const consulta = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (await apiClient.get<{ data: { notas: NotaDaCampanha[] } }>(`${BASE}/${campanhaId}/notes`))
        .data.notas,
    staleTime: 10_000,
  });
  const depois = async () => {
    await queryClient.invalidateQueries({ queryKey: chave });
    await queryClient.invalidateQueries({ queryKey: CHAVE });
  };
  return {
    notas: consulta.data ?? [],
    carregando: consulta.isLoading,
    adicionar: async (n: { kind: TipoDeNota; body: string; note_date?: string }) => {
      try {
        await apiClient.post(`${BASE}/${campanhaId}/notes`, n);
        await depois();
      } catch (e) {
        showApiError(e);
      }
    },
    apagar: async (noteId: string) => {
      try {
        await apiClient.delete(`${BASE}/${campanhaId}/notes/${noteId}`);
        await depois();
      } catch (e) {
        showApiError(e);
      }
    },
  };
}
