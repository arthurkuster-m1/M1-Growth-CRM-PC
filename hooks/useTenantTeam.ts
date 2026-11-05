"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

export type PapelDaEquipe = "viewer" | "agent" | "manager" | "admin";

export interface MembroDaEmpresa {
  user_id: string;
  role: PapelDaEquipe;
  invited_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  email: string | null;
  full_name: string | null;
  last_sign_in_at: string | null;
}

export interface ConviteDaEmpresa {
  id: string;
  email: string;
  role: PapelDaEquipe;
  expires_at: string;
  created_at: string;
}

export interface ConviteEmitido {
  email: string;
  expires_at: string;
  email_dispatched: boolean;
  accept_url: string;
}

const base = (id: string) => `/api/v1/admin/tenants/${id}/team`;

export function useTenantTeam(id: string) {
  return useQuery({
    queryKey: ["admin", "tenant", id, "team"] as const,
    queryFn: () =>
      apiClient.get<{ data: { members: MembroDaEmpresa[]; invites: ConviteDaEmpresa[] } }>(
        base(id),
      ),
    enabled: !!id,
  });
}

export function useTenantTeamActions(id: string) {
  const qc = useQueryClient();
  const chave = ["admin", "tenant", id, "team"] as const;
  const depois = () => {
    void qc.invalidateQueries({ queryKey: chave });
    void qc.invalidateQueries({ queryKey: ["admin", "tenant", id] });
  };
  const alterar = useMutation({
    mutationFn: ({
      userId,
      corpo,
    }: {
      userId: string;
      corpo: { role: PapelDaEquipe } | { revoked: boolean };
    }) => apiClient.patch<unknown>(`${base(id)}/${userId}`, corpo),
    onSettled: depois,
  });
  const convidar = useMutation({
    mutationFn: (corpo: { email: string; role: PapelDaEquipe }) =>
      apiClient.post<{ data: ConviteEmitido }>(base(id), corpo),
    onSettled: depois,
  });
  return { alterar, convidar };
}
