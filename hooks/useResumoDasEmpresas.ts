"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

export interface EmpresaDoResumo {
  id: string;
  slug: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  situacao: "active" | "onboarding" | "suspended" | "redacted" | "archived" | string;
  cor: string | null;
  usuarios_ativos: number;
  campanhas_ativas: number;
  investimento_cents: number;
  leads: number;
  vendas: number;
  faturamento_cents: number;
  entrada: string | null;
  mensalidade: "pago" | "pendente" | null;
  proximo_pagamento: string | null;
  lead_id: string | null;
  lead_titulo: string | null;
}

/** As empresas com os números do período `de`..`ate`; `ids` vazio = todas. */
export function useResumoDasEmpresas(de: string, ate: string, ids: readonly string[]) {
  return useQuery({
    queryKey: ["admin", "tenants", "resumo", de, ate, ids] as const,
    queryFn: async () => {
      const qs = new URLSearchParams({ de, ate });
      if (ids.length > 0) qs.set("ids", ids.join(","));
      const r = await apiClient.get<{
        data: { linhas: EmpresaDoResumo[]; migracao_pendente?: boolean };
      }>(`/api/v1/admin/tenants/resumo?${qs.toString()}`);
      return { linhas: r.data.linhas, migracaoPendente: r.data.migracao_pendente === true };
    },
    staleTime: 30_000,
  });
}
