"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type {
  CadenciaDaCampanha,
  EntradaDaCadencia,
  ModeloDeCadencia,
} from "@/lib/cadencia/cadencia";
import type { PassoDoFluxo } from "@/lib/cadencia/fluxo-da-abordagem";
import { registrarDesfazer } from "@/lib/motor/desfazer";

const BASE = "/api/v1/demand-campaigns";

export interface EtapaDoDestino {
  id: string;
  name: string;
  is_won: boolean;
  is_lost: boolean;
}

interface Resposta {
  cadencia: CadenciaDaCampanha;
  etapas: EtapaDoDestino[];
  modelos: ModeloDeCadencia[];
}

export const paraEntrada = (c: CadenciaDaCampanha): EntradaDaCadencia => ({
  end_action: c.end_action,
  end_stage_id: c.end_stage_id,
  steps: c.steps.map(({ day_offset, medium, approach_id, note }) => ({
    day_offset,
    medium,
    approach_id,
    note,
  })),
});

/** A cadência de uma campanha de prospecção, as etapas do funil dela e os modelos da empresa. */
export function useCadenciaDaCampanha(campanhaId: string) {
  const queryClient = useQueryClient();
  const chave = ["demand-campaign-cadence", campanhaId] as const;
  const consulta = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (await apiClient.get<{ data: Resposta }>(`${BASE}/${campanhaId}/cadence`)).data,
    staleTime: 10_000,
  });
  const recarregar = () => queryClient.invalidateQueries({ queryKey: chave });

  const salvar = async (nova: EntradaDaCadencia): Promise<boolean> => {
    const antes = consulta.data ? paraEntrada(consulta.data.cadencia) : null;
    try {
      await apiClient.put(`${BASE}/${campanhaId}/cadence`, nova);
      await recarregar();
      // Ctrl+Z: volta ao desenho de antes.
      if (antes) {
        registrarDesfazer({
          rotulo: "cadência",
          desfazer: async () => {
            await apiClient.put(`${BASE}/${campanhaId}/cadence`, antes);
            await recarregar();
          },
        });
      }
      return true;
    } catch (e) {
      showApiError(e);
      return false;
    }
  };

  return {
    dados: consulta.data ?? null,
    carregando: consulta.isLoading,
    salvar,
    aplicarModelo: async (templateId: string): Promise<boolean> => {
      try {
        await apiClient.post(`${BASE}/${campanhaId}/cadence/apply-template`, {
          template_id: templateId,
        });
        await recarregar();
        return true;
      } catch (e) {
        showApiError(e);
        return false;
      }
    },
    salvarComoModelo: async (name: string): Promise<boolean> => {
      try {
        await apiClient.post("/api/v1/cadence-templates", { name, campaign_id: campanhaId });
        await recarregar();
        return true;
      } catch (e) {
        showApiError(e);
        return false;
      }
    },
    apagarModelo: async (id: string): Promise<void> => {
      try {
        await apiClient.delete(`/api/v1/cadence-templates/${id}`);
        await recarregar();
      } catch (e) {
        showApiError(e);
      }
    },
    inscreverQuemJaEstaEmAbordagem: async (): Promise<number | null> => {
      try {
        const r = await apiClient.post<{ data: { inscritos: number } }>(
          `${BASE}/${campanhaId}/cadence/enroll`,
          {},
        );
        await recarregar();
        return r.data.inscritos;
      } catch (e) {
        showApiError(e);
        return null;
      }
    },
  };
}

/** O fluxo de conversa de UMA abordagem de WhatsApp (desenho; nada é enviado). */
export function useFluxoDaAbordagem(campanhaId: string, abordagemId: string) {
  const queryClient = useQueryClient();
  const chave = ["demand-approach-flow", abordagemId] as const;
  const base = `${BASE}/${campanhaId}/approaches/${abordagemId}/flow`;
  const consulta = useQuery({
    queryKey: chave,
    queryFn: async () =>
      (await apiClient.get<{ data: { steps: PassoDoFluxo[] } }>(base)).data.steps,
    staleTime: 10_000,
  });
  return {
    passos: consulta.data ?? null,
    carregando: consulta.isLoading,
    salvar: async (steps: PassoDoFluxo[]): Promise<boolean> => {
      const antes = consulta.data ?? null;
      try {
        await apiClient.put(base, { steps });
        await queryClient.invalidateQueries({ queryKey: chave });
        // Ctrl+Z: volta ao desenho de antes.
        if (antes) {
          registrarDesfazer({
            rotulo: "fluxo da abordagem",
            desfazer: async () => {
              await apiClient.put(base, { steps: antes });
              await queryClient.invalidateQueries({ queryKey: chave });
            },
          });
        }
        return true;
      } catch (e) {
        showApiError(e);
        return false;
      }
    },
  };
}
