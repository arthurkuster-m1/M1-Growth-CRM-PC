"use client";

import { useT } from "@/hooks/i18n/useT";

import { useEffect, useSyncExternalStore } from "react";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useNotificationPermission } from "@/hooks/notifications/useNotificationPermission";
import {
  NOTIFY_UI_CATEGORIES,
  assinarPrefs,
  getPrefsSnapshot,
  getPrefsSnapshotDoServidor,
  gravarCanal,
  sincronizarPrefsDoServidor,
  type NotifyCategory,
  type NotifyChannelPref,
} from "@/lib/notifications/prefs";
import { syncPushSubscription } from "@/lib/notifications/push_client";

const LABELS: Record<NotifyCategory, string> = {
  mensagem: "Mensagem nova nas suas conversas",
  lead_novo: "Novo lead",
  lead_atribuido: "Lead atribuído a você",
  mencao: "Você foi mencionado",
  tarefa: "Nova tarefa para você",
  atendimento: "Atendimento (IA passou a conversa, ligação perdida…)",
  crm: "CRM (etapa que avisa, proposta pronta)",
  sistema: "Erros de sistema (WhatsApp caiu, IA sem saldo…)",
  ligacao: "Ligação tocando",
};

export function NotificationPrefsClient() {
  const t = useT();
  const { permission, request } = useNotificationPermission();
  const prefs = useSyncExternalStore(assinarPrefs, getPrefsSnapshot, getPrefsSnapshotDoServidor);
  const denied = permission === "denied";

  // A escolha mora no servidor (vale em todo aparelho); a tela abre com o espelho local e troca.
  useEffect(() => {
    void sincronizarPrefsDoServidor();
  }, []);
  const unsupported = permission === "unsupported";

  async function onToggle(category: NotifyCategory, channel: NotifyChannelPref, on: boolean) {
    if (channel === "push" && on) {
      if (permission !== "granted") {
        const next = await request();
        if (next !== "granted") return;
      }
    }
    gravarCanal(category, channel, on);
    // Ligou o celular: garante que este aparelho está inscrito para receber o push.
    if (channel === "push" && on) void syncPushSubscription();
  }

  return (
    <Card className="p-0">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr>
            <th className="px-4 py-3 text-left font-medium">{t("Categoria")}</th>
            <th className="px-4 py-3 text-center font-medium">{t("Na tela")}</th>
            <th className="px-4 py-3 text-center font-medium">{t("No celular")}</th>
          </tr>
        </thead>
        <tbody>
          {NOTIFY_UI_CATEGORIES.map((cat) => (
            <tr key={cat} className="border-b last:border-0">
              <td className="px-4 py-3">
                {t(LABELS[cat])}
                {cat === "mensagem" && denied ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(
                      "O navegador bloqueou as notificações. Libere-as nas configurações do site e recarregue.",
                    )}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-center">
                <Switch
                  checked={prefs[cat].in_app}
                  onCheckedChange={(on) => void onToggle(cat, "in_app", on)}
                  aria-label={`${t(LABELS[cat])} via in_app`}
                />
              </td>
              <td className="px-4 py-3 text-center">
                <Switch
                  checked={prefs[cat].push}
                  disabled={denied || unsupported}
                  onCheckedChange={(on) => void onToggle(cat, "push", on)}
                  aria-label={`${t(LABELS[cat])} via push`}
                  data-testid={
                    cat === "mensagem"
                      ? prefs.mensagem.push
                        ? "alerts-toggle"
                        : "alerts-enable"
                      : undefined
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
