"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { RiskBucket } from "@/lib/leads/risk-radar";
import type { AtRiskData } from "./useAtRiskLeads";

/** Quantos negócios fora do "em dia" a coluna Radar alcança (o teto do radar é 500). */
const LIMITE = 500;

/**
 * O RADAR POR OPORTUNIDADE — o balde de risco de cada negócio, para a coluna "Radar" do CRM.
 *
 * Vem da MESMA rota e da MESMA classificação do radar (`classifyRisk`, com a janela de cada etapa,
 * o follow-up em voo e a proteção da agenda): a tela do CRM e a IA dizem a mesma coisa sobre o
 * mesmo negócio. A rota só lista quem saiu do "em dia"; negócio aberto que não está na lista está
 * em dia.
 */
export function useRadarDasOportunidades() {
  return useQuery({
    queryKey: ["leads-at-risk", "crm", LIMITE],
    refetchInterval: 60_000,
    queryFn: () =>
      apiClient.get<{ data: AtRiskData }>(`/api/v1/leads/at-risk?limit=${LIMITE}`).then((r) => {
        const porLead = new Map<string, RiskBucket>();
        for (const item of r.data.items) porLead.set(item.id, item.risk);
        return porLead;
      }),
  });
}
