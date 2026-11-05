"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { destinosDaInterface } from "@/lib/navigation/interface";

import { useAgentInbox } from "@/hooks/ai/useAgentInbox";
import { useSonsDaCentral } from "@/hooks/notifications/useSonsDaCentral";
import { useT } from "@/hooks/i18n/useT";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "@/lib/ui/icons";

/**
 * Sino da central de avisos (Operação Visível F1): contador de avisos abertos
 * do runtime do agente no header; clique leva a /app/ai/inbox.
 */
export function AlertsBell() {
  const { user, activeOrg } = useAuth();
  if (
    !destinosDaInterface(
      activeOrg?.interface_settings,
      user.is_platform_admin && !user.support,
      activeOrg?.role ?? null,
    ).some((d) => d.href === "/app/ai/inbox")
  )
    return null;
  return <VisibleAlertsBell />;
}
function VisibleAlertsBell() {
  const t = useT();
  const { activeOrg } = useAuth();
  const { data } = useAgentInbox("open");
  // O som da organização para a etapa que avisa e o pedido de pessoa.
  useSonsDaCentral(data?.items);
  const count = data?.open_count ?? 0;
  const itens = (data?.items ?? []).slice(0, 5);

  /*
   * O sino ABRE uma prévia dos avisos (de qual empresa são e o que dizem), em vez de levar direto à
   * Central: antes, um "1" vermelho não dizia nada, e no Modo agência ele é da última empresa em
   * que a pessoa entrou (a organização ativa continua sendo a dela).
   */
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            count > 0
              ? `${t("Central de avisos")} — ${count} ${t("em aberto")}`
              : t("Central de avisos")
          }
          data-testid="alerts-bell"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9 lg:w-9"
        >
          <Bell size={18} aria-hidden />
          {count > 0 ? (
            <span
              data-testid="alerts-bell-count"
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-destructive-foreground"
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">{t("Central de avisos")}</p>
          {activeOrg?.name ? (
            <p className="truncate text-xs text-muted-foreground">
              {t("Empresa")}: {activeOrg.name}
            </p>
          ) : null}
        </div>
        {itens.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{t("Nenhum aviso em aberto.")}</p>
        ) : (
          <ul className="max-h-72 divide-y overflow-y-auto">
            {itens.map((item) => (
              <li key={item.id} className="px-3 py-2">
                <p className="text-sm font-medium">{item.title}</p>
                {item.body ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="border-t px-3 py-2">
          <Link href="/app/ai/inbox" className="text-sm font-medium text-primary hover:underline">
            {count > itens.length
              ? `${t("Ver os")} ${count} ${t("avisos na Central")}`
              : t("Abrir a Central de avisos")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
