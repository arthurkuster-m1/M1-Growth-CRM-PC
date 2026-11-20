"use client";

import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useActiveOrg, useUser } from "@/hooks/auth/AuthProvider";
import { getOpenConversationId } from "@/hooks/notifications/OpenConversationContext";
import { CHAVE_DAS_NOTIFICACOES } from "@/hooks/notifications/useNotificacoesDaPessoa";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { avisoDaLinha } from "@/lib/notifications/aviso-na-tela";
import { entregarAviso } from "@/lib/notifications/deliver";
import { sincronizarPrefsDoServidor } from "@/lib/notifications/prefs";
import { syncPushSubscription } from "@/lib/notifications/push_client";

function abaEmFoco(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "visible" && document.hasFocus();
}

/**
 * Os avisos da TELA vêm das notificações da própria pessoa (`notificacoes`, migration 0697) —
 * as mesmas linhas que geram o push no celular. Quem recebe e o que diz já foi decidido no
 * servidor (`lib/notifications/montar-avisos.ts`); aqui só se desenha.
 */
export function useNotificacoesPessoais(): void {
  const orgId = useActiveOrg()?.orgId ?? null;
  const user = useUser();
  const qc = useQueryClient();

  useEffect(() => {
    if (!orgId) return;
    void syncPushSubscription();
    // As escolhas feitas em outro aparelho valem aqui também.
    void sincronizarPrefsDoServidor();
  }, [orgId]);

  const onChange = useCallback(
    (payload: unknown) => {
      const p = payload as { tipo?: unknown; new?: unknown };
      // O sino ("Para você") relê a lista — também depois de reconectar, quando algo pode ter
      // chegado enquanto o canal estava fora.
      void qc.invalidateQueries({ queryKey: CHAVE_DAS_NOTIFICACOES });
      if (p?.tipo === "reassinado") return;
      const linha = p?.new;
      if (!linha || typeof linha !== "object" || Array.isArray(linha)) return;
      const aviso = avisoDaLinha(linha as Record<string, unknown>, {
        organizacaoAtiva: orgId,
        conversaAbertaEmFoco: abaEmFoco() ? getOpenConversationId() : null,
      });
      if (aviso) entregarAviso(aviso);
    },
    [orgId, qc],
  );

  useRealtimeChannel({
    name: user.id ? `notificacoes-${user.id}` : "notificacoes-desligado",
    postgresChanges: user.id
      ? {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${user.id}`,
        }
      : undefined,
    onChange,
    enabled: !!user.id && !!orgId,
  });
}
