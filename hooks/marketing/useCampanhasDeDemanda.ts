"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { CampanhaDeDemanda, NotaDaCampanha, TipoDeNota } from "@/lib/marketing/campanhas";
import type { DiaDaCampanha } from "@/lib/marketing/campanhas-resumo";
import type { Criativo } from "@/lib/marketing/criativos";

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
    | "id"
    | "position"
    | "created_at"
    | "ultima_analise"
    | "ultimo_planejamento"
    | "meta_synced_at"
    | "meta_sync_error"
    | "estado"
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

/** O dia a dia de uma campanha (a "aba diária" da planilha). */
export function useDiasDaCampanha(campanhaId: string) {
  const queryClient = useQueryClient();
  const chave = ["demand-campaign-days", campanhaId] as const;
  const consulta = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { dias: DiaDaCampanha[]; funil_definido: boolean } }>(
          `${BASE}/${campanhaId}/days`,
        )
      ).data,
    staleTime: 10_000,
  });
  const recarregar = () => queryClient.invalidateQueries({ queryKey: chave });
  return {
    dias: consulta.data?.dias ?? [],
    funilDefinido: consulta.data?.funil_definido ?? true,
    carregando: consulta.isLoading,
    gravar: async (
      dias: Array<Omit<DiaDaCampanha, "id" | "source">>,
      source: "manual" | "csv" = "manual",
    ) => {
      // Muda a tela na hora; o servidor confirma em seguida.
      queryClient.setQueryData<{ dias: DiaDaCampanha[]; funil_definido: boolean }>(
        chave,
        (atual) => {
          const mapa = new Map((atual?.dias ?? []).map((d) => [d.day, d]));
          // O `leads` da linha é do CRM: a edição não o troca.
          for (const d of dias)
            mapa.set(d.day, { ...d, leads: mapa.get(d.day)?.leads ?? 0, source });
          return {
            funil_definido: atual?.funil_definido ?? true,
            dias: [...mapa.values()].sort((x, y) => x.day.localeCompare(y.day)),
          };
        },
      );
      try {
        await apiClient.put(`${BASE}/${campanhaId}/days`, { dias, source });
        return true;
      } catch (e) {
        showApiError(e);
        return false;
      } finally {
        void recarregar();
      }
    },
    apagar: async (day: string) => {
      try {
        await apiClient.delete(`${BASE}/${campanhaId}/days?day=${day}`);
      } catch (e) {
        showApiError(e);
      } finally {
        void recarregar();
      }
    },
  };
}

export interface OpcoesDoMeta {
  contas: Array<{ id: string; name: string }>;
  conta_padrao: string | null;
  account_id: string | null;
  campanhas: Array<{
    id: string;
    name: string;
    status: string | null;
    associada_a: { id: string; name: string } | null;
  }>;
}

/** As contas e campanhas do Meta que dá para atrelar (só busca quando `ativo`). */
export function useOpcoesDoMeta(conta: string, ativo: boolean) {
  const consulta = useQuery({
    queryKey: ["demand-campaign-meta-options", conta],
    enabled: ativo,
    staleTime: 60_000,
    retry: false,
    queryFn: async () =>
      (
        await apiClient.get<{ data: OpcoesDoMeta }>(
          `${BASE}/meta-options${conta ? `?account_id=${encodeURIComponent(conta)}` : ""}`,
        )
      ).data,
  });
  return {
    opcoes: consulta.data ?? null,
    carregando: consulta.isFetching,
    erro: consulta.isError ? ((consulta.error as { message?: string } | null)?.message ?? "") : "",
    recarregar: () => void consulta.refetch(),
  };
}

/** Puxa agora o dia a dia do Meta desta campanha. */
export function useSincronizarComMeta(campanhaId: string) {
  const queryClient = useQueryClient();
  return async (): Promise<{ ok: true; dias: number } | { ok: false; motivo: string }> => {
    try {
      const r = await apiClient.post<{ data: { dias: number } }>(
        `${BASE}/${campanhaId}/sync-meta`,
        {},
      );
      return { ok: true, dias: r.data.dias };
    } catch (e) {
      const motivo = (e as { message?: string } | null)?.message ?? "transitorio";
      return { ok: false, motivo };
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["demand-campaign-days", campanhaId] });
      await queryClient.invalidateQueries({ queryKey: CHAVE });
    }
  };
}

/** Os criativos (anúncios e legendas) de uma campanha. */
export function useCriativosDaCampanha(campanhaId: string) {
  const queryClient = useQueryClient();
  const chave = ["demand-campaign-creatives", campanhaId] as const;
  const consulta = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (await apiClient.get<{ data: { criativos: Criativo[] } }>(`${BASE}/${campanhaId}/creatives`))
        .data.criativos,
    staleTime: 10_000,
  });
  const recarregar = () => queryClient.invalidateQueries({ queryKey: chave });
  return {
    criativos: consulta.data ?? [],
    carregando: consulta.isLoading,
    criar: async (entrada: EdicaoDeCriativo & { name: string }) => {
      try {
        await apiClient.post(`${BASE}/${campanhaId}/creatives`, entrada);
        await recarregar();
      } catch (e) {
        showApiError(e);
      }
    },
    editar: async (id: string, patch: EdicaoDeCriativo) => {
      queryClient.setQueryData<Criativo[]>(chave, (l) =>
        (l ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
      try {
        await apiClient.patch(`${BASE}/${campanhaId}/creatives/${id}`, patch);
      } catch (e) {
        showApiError(e);
      } finally {
        void recarregar();
      }
    },
    apagar: async (id: string) => {
      try {
        await apiClient.delete(`${BASE}/${campanhaId}/creatives/${id}`);
      } catch (e) {
        showApiError(e);
      } finally {
        void recarregar();
      }
    },
    importarDoMeta: async (): Promise<
      { ok: true; criados: number; existentes: number } | { ok: false; motivo: string }
    > => {
      try {
        const r = await apiClient.post<{ data: { criados: number; existentes: number } }>(
          `${BASE}/${campanhaId}/creatives/import-meta`,
          {},
        );
        return { ok: true, ...r.data };
      } catch (e) {
        return { ok: false, motivo: (e as { message?: string } | null)?.message ?? "transitorio" };
      } finally {
        void recarregar();
      }
    },
  };
}

export type EdicaoDeCriativo = Partial<
  Pick<
    Criativo,
    "name" | "status" | "format" | "headline" | "caption" | "media_url" | "link_url" | "notes"
  >
>;
