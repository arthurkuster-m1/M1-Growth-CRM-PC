"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminTenantRow {
  id: string;
  slug: string;
  display_name: string;
  legal_name: string | null;
  cnpj: string | null;
  status: string;
  onboarded_at: string | null;
  suspended_at: string | null;
  created_at: string;
  cor_agencia: string | null;
  cor_marca: string | null;
  user_count: Array<{ count: number }> | null;
  conversations_count: Array<{ count: number }> | null;
}

export interface AdminTenantsFilters {
  q?: string;
  status?: "active" | "suspended" | "onboarding" | "redacted";
}

interface ListResponse {
  data: AdminTenantRow[];
  meta?: { cursor?: string | null; has_more?: boolean };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** `ids` vazio = todas as empresas; com ids, só essas (o seletor do Modo agência). */
export function useAdminTenants(filters: AdminTenantsFilters = {}, ids: readonly string[] = []) {
  return useInfiniteQuery({
    queryKey: ["admin", "tenants", filters, ids] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (filters.q) qs.set("q", filters.q);
      if (filters.status) qs.set("status", filters.status);
      if (ids.length > 0) qs.set("ids", ids.join(","));
      if (pageParam) qs.set("cursor", pageParam);
      qs.set("limit", "30");
      return apiClient.get<ListResponse>(`/api/v1/admin/tenants?${qs.toString()}`);
    },
    getNextPageParam: (last) =>
      last.meta?.has_more && last.meta.cursor ? last.meta.cursor : undefined,
    staleTime: 30_000,
  });
}
