"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { useAgentInbox } from "@/hooks/ai/useAgentInbox";
import { useT } from "@/hooks/i18n/useT";
import {
  useMarcarNotificacoesLidas,
  useNotificacoesDaPessoa,
  type NotificacaoDaPessoa,
} from "@/hooks/notifications/useNotificacoesDaPessoa";
import { useSonsDaCentral } from "@/hooks/notifications/useSonsDaCentral";
import { destinosDaInterface } from "@/lib/navigation/interface";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Checks } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * O SINO do topo, com duas abas:
 *
 *   - **Para você** — as notificações da própria pessoa (`notificacoes`, migration 0697): as mesmas
 *     que chegaram no canto da tela e no celular, com os mesmos botões. Lidas e não lidas.
 *   - **Central** — os avisos operacionais da empresa (`agent_inbox_items`), para quem tem acesso.
 *
 * O número vermelho soma o que ainda pede atenção nas duas: notificações não lidas + avisos
 * abertos da Central.
 */
export function AlertsBell() {
  const { user, activeOrg } = useAuth();
  const temCentral = destinosDaInterface(
    activeOrg?.interface_settings,
    user.is_platform_admin && !user.support,
    activeOrg?.role ?? null,
  ).some((d) => d.href === "/app/ai/inbox");
  return <SinoVisivel temCentral={temCentral} />;
}

type Aba = "para_voce" | "central";

function SinoVisivel({ temCentral }: { temCentral: boolean }) {
  const t = useT();
  const { activeOrg } = useAuth();
  const pessoais = useNotificacoesDaPessoa();
  const central = useAgentInbox("open");
  // O som da organização para a etapa que avisa e o pedido de pessoa.
  useSonsDaCentral(temCentral ? central.data?.items : undefined);
  const marcar = useMarcarNotificacoesLidas();

  const naoLidas = pessoais.data?.nao_lidas ?? 0;
  const abertosNaCentral = temCentral ? (central.data?.open_count ?? 0) : 0;
  const total = naoLidas + abertosNaCentral;

  // Abre onde há o que ver: as suas primeiro; sem nenhuma nova, a Central se tiver aviso.
  const abaInicial: Aba = naoLidas === 0 && abertosNaCentral > 0 ? "central" : "para_voce";
  const [escolhida, setEscolhida] = useState<Aba | null>(null);
  const aba: Aba = temCentral ? (escolhida ?? abaInicial) : "para_voce";

  return (
    <Popover onOpenChange={(aberto) => !aberto && setEscolhida(null)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            total > 0 ? `${t("Notificações")} — ${total} ${t("novas")}` : t("Notificações")
          }
          data-testid="alerts-bell"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9 lg:w-9"
        >
          <Bell size={18} aria-hidden />
          {total > 0 ? (
            <span
              data-testid="alerts-bell-count"
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-destructive-foreground"
            >
              {total > 99 ? "99+" : total}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("Notificações")}</p>
            {activeOrg?.name ? (
              <p className="truncate text-xs text-muted-foreground">
                {t("Empresa")}: {activeOrg.name}
              </p>
            ) : null}
          </div>
          {aba === "para_voce" && naoLidas > 0 ? (
            <button
              type="button"
              onClick={() => marcar.mutate({ todas: true })}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Checks size={14} aria-hidden />
              {t("Marcar todas como lidas")}
            </button>
          ) : null}
        </div>

        {temCentral ? (
          <div role="tablist" className="flex gap-1 border-b px-3 py-2">
            <BotaoDeAba
              ativa={aba === "para_voce"}
              onClick={() => setEscolhida("para_voce")}
              contagem={naoLidas}
            >
              {t("Para você")}
            </BotaoDeAba>
            <BotaoDeAba
              ativa={aba === "central"}
              onClick={() => setEscolhida("central")}
              contagem={abertosNaCentral}
            >
              {t("Central")}
            </BotaoDeAba>
          </div>
        ) : null}

        {aba === "para_voce" ? (
          <ParaVoce
            itens={pessoais.data?.itens ?? []}
            onAbrir={(n) => {
              if (!n.lida_em) marcar.mutate({ ids: [n.id] });
            }}
          />
        ) : (
          <Central itens={central.data?.items ?? []} total={abertosNaCentral} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function BotaoDeAba({
  ativa,
  onClick,
  contagem,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  contagem: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
        ativa ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
      {contagem > 0 ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] leading-4",
            ativa ? "bg-primary-foreground/20" : "bg-muted-foreground/15",
          )}
        >
          {contagem > 99 ? "99+" : contagem}
        </span>
      ) : null}
    </button>
  );
}

function haQuanto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

function ParaVoce({
  itens,
  onAbrir,
}: {
  itens: NotificacaoDaPessoa[];
  onAbrir: (n: NotificacaoDaPessoa) => void;
}) {
  const t = useT();
  if (itens.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        {t("Nenhuma notificação para você por enquanto.")}
      </p>
    );
  }
  return (
    <ul className="max-h-[26rem] divide-y overflow-y-auto" data-testid="sino-para-voce">
      {itens.map((n) => (
        <li key={n.id} className={cn("px-3 py-2.5", !n.lida_em && "bg-primary/5")}>
          <div className="flex items-start gap-2">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                n.lida_em ? "bg-transparent" : "bg-primary",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", !n.lida_em && "font-semibold")}>{n.titulo}</p>
              {n.corpo ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{n.corpo}</p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {n.acoes.map((a, i) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    onClick={() => onAbrir(n)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      i === 0
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border text-foreground hover:bg-muted",
                    )}
                  >
                    {a.rotulo}
                  </Link>
                ))}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {haQuanto(n.created_at)}
                </span>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Central({
  itens,
  total,
}: {
  itens: Array<{ id: string; title: string; body: string | null }>;
  total: number;
}) {
  const t = useT();
  const previa = itens.slice(0, 5);
  return (
    <>
      {previa.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">{t("Nenhum aviso em aberto.")}</p>
      ) : (
        <ul className="max-h-72 divide-y overflow-y-auto">
          {previa.map((item) => (
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
          {total > previa.length
            ? `${t("Ver os")} ${total} ${t("avisos na Central")}`
            : t("Abrir a Central de avisos")}
        </Link>
      </div>
    </>
  );
}
