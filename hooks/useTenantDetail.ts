"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { InterfaceSettings } from "@/lib/navigation/interface";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantOrganization {
  id: string;
  slug: string;
  display_name: string;
  legal_name: string | null;
  cnpj: string | null;
  // 'onboarding' não existe na check constraint do banco — é estado derivado
  // (active + onboarded_at null), nunca vem numa linha real.
  status: "active" | "suspended" | "redacted";
  timezone: string;
  locale: string;
  currency: string;
  country: string | null;
  dpo_email: string | null;
  privacy_policy_url: string | null;
  ai_budget_cents: number | null;
  media_retention_days: number;
  interface_settings: InterfaceSettings | null;
  onboarded_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  agencia_lead_id: string | null;
  onboarding_state: {
    welcome?: {
      accepted_at?: string;
      o_que_faz?: string;
      display_name?: string;
      timezone?: string;
    };
  } | null;
  created_at: string;
  settings: Record<string, unknown> | null;
}

export interface TenantCounts {
  user_count: number;
  conversations_count: number;
  messages_count: number;
  leads_count: number;
  orders_count: number;
  /** Oportunidades ganhas (vendas com pagamento). */
  vendas_pagas: number;
  lgpd_requests_pending: number;
  ai_invocations_30d: number;
  waha_sessions_count: number;
}

export interface TenantDetailResponse {
  data: {
    organization: TenantOrganization;
    counts: TenantCounts;
    agencia_lead: { id: string; title: string } | null;
    /** A mensalidade, vinda do lead da agência (`null` sem lead ou sem a migration 0684). */
    mensalidade: {
      status: "pago" | "pendente" | null;
      proximo_pagamento: string | null;
    } | null;
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTenantDetail(id: string) {
  return useQuery({
    queryKey: ["admin", "tenant", id] as const,
    queryFn: () => apiClient.get<TenantDetailResponse>(`/api/v1/admin/tenants/${id}`),
    staleTime: 60_000,
    enabled: !!id,
  });
}
