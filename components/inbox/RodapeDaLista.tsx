"use client";
/**
 * O rodapé da lista de conversas: em qual número você está atendendo (etiquetas coloridas) e o
 * atalho para as configurações do Inbox. O seletor só existe quando a empresa tem mais de um
 * número; escolher um filtra a lista (o mesmo `channel_session_id` do filtro de cima).
 */
import Link from "next/link";
import { Gear } from "@phosphor-icons/react";

import { useT } from "@/hooks/i18n/useT";
import { channelLabel, useChannelSessions } from "@/hooks/channels/useChannelSessions";
import { useConfigDoInbox } from "@/hooks/inbox/useConfigDoInbox";
import { nomeDoNumero } from "@/lib/inbox/configuracao";
import { cn } from "@/lib/utils";

interface Props {
  numeroEscolhido?: string;
  aoEscolherNumero: (id: string | undefined) => void;
}

export function RodapeDaLista({ numeroEscolhido, aoEscolherNumero }: Props) {
  const t = useT();
  const { data: canais } = useChannelSessions({ refetchInterval: 60_000 });
  const config = useConfigDoInbox();
  const ativos = (canais ?? []).filter((c) => c.metadata?.disabled !== true);

  return (
    <div
      data-testid="rodape-da-lista"
      className="shrink-0 space-y-2 border-t border-border bg-card px-3 py-2"
    >
      {ativos.length >= 2 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("Número em atendimento")}>
          <ChipDoNumero
            ativo={numeroEscolhido == null}
            onClick={() => aoEscolherNumero(undefined)}
            rotulo={t("Todos")}
          />
          {ativos.map((c) => (
            <ChipDoNumero
              key={c.id}
              ativo={numeroEscolhido === c.id}
              cor={config.numeros[c.id]?.cor}
              rotulo={nomeDoNumero(config, c.id, channelLabel(c, t))}
              onClick={() => aoEscolherNumero(numeroEscolhido === c.id ? undefined : c.id)}
            />
          ))}
        </div>
      )}
      <Link
        href="/app/inbox/configuracoes"
        className="flex items-center gap-2 rounded-md px-1 py-1 text-xs text-text-muted hover:bg-surface-elevated hover:text-text"
      >
        <Gear size={16} aria-hidden />
        {t("Configurações do Inbox")}
      </Link>
    </div>
  );
}

function ChipDoNumero({
  rotulo,
  cor,
  ativo,
  onClick,
}: {
  rotulo: string;
  cor?: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
        ativo ? "text-foreground" : "border-border bg-transparent text-text-muted hover:bg-surface-elevated",
      )}
      style={
        ativo && cor
          ? { borderColor: cor, backgroundColor: `color-mix(in srgb, ${cor} 18%, transparent)` }
          : ativo
            ? { borderColor: "var(--accent)", backgroundColor: "var(--accent-soft)" }
            : undefined
      }
    >
      {cor ? (
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
      ) : null}
      <span className="truncate">{rotulo}</span>
    </button>
  );
}
