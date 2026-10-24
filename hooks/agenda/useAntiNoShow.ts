"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import { empacotarLembretes, type PassoDeLembrete } from "@/lib/agenda/lembretes";
import type { EntradaDoFluxo, FluxoAntiNoShow } from "@/lib/agenda/anti-no-show";

export interface TipoParaOFluxo {
  id: string;
  name: string;
  lembrete_ligado: boolean;
  /** Cada lembrete do tipo (antecedência em minutos + mensagem), do mais distante ao mais próximo. */
  lembretes: PassoDeLembrete[];
}

interface Resposta {
  fluxos: FluxoAntiNoShow[];
  tipos: TipoParaOFluxo[];
  modelo: Omit<EntradaDoFluxo, "name" | "event_type_ids">;
}

const BASE = "/api/v1/agenda/anti-no-show";

/** Os fluxos anti no-show da empresa e os tipos de compromisso a que podem se aplicar. */
export function useAntiNoShow() {
  const queryClient = useQueryClient();
  const chave = ["agenda-anti-no-show"] as const;
  const consulta = useQuery({
    queryKey: chave,
    queryFn: async () => (await apiClient.get<{ data: Resposta }>(BASE)).data,
    staleTime: 10_000,
  });
  const recarregar = () => queryClient.invalidateQueries({ queryKey: chave });
  const tentar = async (acao: () => Promise<unknown>): Promise<boolean> => {
    try {
      await acao();
      await recarregar();
      return true;
    } catch (e) {
      showApiError(e);
      return false;
    }
  };
  return {
    dados: consulta.data ?? null,
    carregando: consulta.isLoading,
    criar: (entrada: EntradaDoFluxo) => tentar(() => apiClient.post(BASE, entrada)),
    salvar: (id: string, entrada: EntradaDoFluxo) =>
      tentar(() => apiClient.put(`${BASE}/${id}`, entrada)),
    apagar: (id: string) => tentar(() => apiClient.delete(`${BASE}/${id}`)),
    /** Grava as mensagens dos lembretes de UM tipo (a mesma rota da tela de Tipos de atendimento). */
    salvarMensagens: (tipoId: string, passos: PassoDeLembrete[]) => {
      const emp = empacotarLembretes(passos);
      return tentar(() =>
        apiClient.patch("/api/v1/agenda/tipos", {
          id: tipoId,
          reminder_minutes_before: emp.principal,
          reminder_extra_offsets_minutes: emp.extras,
          reminder_body: emp.corpoPrincipal,
          reminder_bodies: emp.corposExtras,
        }),
      );
    },
  };
}
