"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

/** O valor do seletor de responsável que significa "qualquer atendente (o menos carregado)". */
export const QUALQUER_ATENDENTE = "qualquer";

export type MatrizDeAtendentes = {
  tabela_existe: boolean;
  tipos: Array<{ id: string; nome: string; responsavel_padrao: string | null }>;
  matriz: Array<{ event_type_id: string; user_id: string; priority: number; is_active: boolean }>;
  membros: Array<{ user_id: string; role: string }>;
  com_google: string[];
};

export function useMatrizDeAtendentes() {
  return useQuery({
    queryKey: ["agenda", "atendentes-do-tipo"],
    staleTime: 20_000,
    queryFn: async () => (await apiClient.get<{ data: MatrizDeAtendentes }>("/api/v1/agenda/atendentes-do-tipo")).data,
  });
}

/** Quem faz o tipo: a matriz; sem ela (ou sem linhas para o tipo), só o responsável padrão. */
export function atendentesDoTipoNaMatriz(m: MatrizDeAtendentes | undefined, tipoId: string): string[] {
  if (!m) return [];
  const linhas = m.matriz.filter((l) => l.event_type_id === tipoId && l.is_active).map((l) => l.user_id);
  if (linhas.length > 0) return linhas;
  const padrao = m.tipos.find((t) => t.id === tipoId)?.responsavel_padrao;
  return padrao ? [padrao] : [];
}

export type AtendenteLivreNaTela = { user_id: string; priority: number; carga: number; google: boolean };

/** Escolhi o horário: quais atendentes do tipo estão livres nele. */
export function useAtendentesLivres(tipoId: string | null, quando: string | null, ignorarId?: string) {
  return useQuery({
    queryKey: ["agenda", "atendentes-livres", tipoId, quando, ignorarId ?? null],
    enabled: Boolean(tipoId && quando),
    staleTime: 10_000,
    queryFn: async () => {
      const qs = new URLSearchParams({ event_type_id: tipoId!, starts_at: quando! });
      if (ignorarId) qs.set("ignorar_agendamento_id", ignorarId);
      return (await apiClient.get<{ data: { atendentes: AtendenteLivreNaTela[] } }>(`/api/v1/agenda/atendentes-livres?${qs}`)).data
        .atendentes;
    },
  });
}
