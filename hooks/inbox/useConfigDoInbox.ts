"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { CONFIG_DO_INBOX_VAZIA, type ConfigDoInbox } from "@/lib/inbox/configuracao";

const CHAVE = "config-do-inbox";

/** Nome/cor dos números e o que o filtro de tags esconde. Sem dado, tudo aparece (padrão). */
export function useConfigDoInbox(): ConfigDoInbox {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.orgId ?? null;
  const { data } = useQuery({
    queryKey: [CHAVE, orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await apiClient.get<{ data: ConfigDoInbox }>("/api/v1/inbox/configuracoes")).data,
  });
  return data ?? CONFIG_DO_INBOX_VAZIA;
}

export function useSalvarConfigDoInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: ConfigDoInbox) =>
      (await apiClient.put<{ data: ConfigDoInbox }>("/api/v1/inbox/configuracoes", config)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: [CHAVE] }),
  });
}
