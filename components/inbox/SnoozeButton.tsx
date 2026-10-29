"use client";
import { useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock } from "@/lib/ui/icons";
import { useSnoozeConversation } from "@/hooks/inbox/useSnoozeConversation";

interface Props {
  conversationId: string;
  snoozeUntil: string | null;
  disabled?: boolean;
  /**
   * `lista`: as opções em linha (dentro do menu "Opções" do cabeçalho); o "Outro…" avisa quem
   * mostra o diálogo (`aoEscolherOutro`), porque o menu fecha e levaria o diálogo junto.
   */
  variante?: "botao" | "lista";
  aoEscolherOutro?: () => void;
  aoEscolher?: () => void;
}

const DURATIONS: Array<{ hours: 1 | 3 | 24; label: string }> = [
  { hours: 1, label: "Em 1 hora" },
  { hours: 3, label: "Em 3 horas" },
  { hours: 24, label: "Em 24 horas" },
];

function isSnoozeActive(snoozeUntil: string | null): boolean {
  return snoozeUntil != null && new Date(snoozeUntil).getTime() > Date.now();
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const diaLocal = (d: Date) =>
  `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

/** O "Outro": escolher o dia e a hora em que quer ser lembrado. */
export function LembreteOutroDialog({
  conversationId,
  aberto,
  aoFechar,
}: {
  conversationId: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const t = useT();
  const { snooze } = useSnoozeConversation();
  const amanha = new Date(Date.now() + 24 * 3600_000);
  const [dia, setDia] = useState(diaLocal(amanha));
  const [hora, setHora] = useState("09:00");
  const quando = dia && hora ? new Date(`${dia}T${hora}:00`) : null;
  const noFuturo = quando !== null && quando.getTime() > Date.now();

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("Lembrar em…")}</DialogTitle>
          <DialogDescription>
            {t("Escolha o dia e a hora em que você quer ser avisado desta conversa.")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t("Dia")}
            <input
              type="date"
              value={dia}
              min={diaLocal(new Date())}
              onChange={(e) => setDia(e.target.value)}
              className="h-10 rounded-xl border bg-card px-2 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t("Hora")}
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="h-10 rounded-xl border bg-card px-2 text-sm text-foreground"
            />
          </label>
        </div>
        {!noFuturo ? (
          <p className="text-xs text-error-fg">{t("Escolha um dia e uma hora no futuro.")}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>
            {t("Cancelar")}
          </Button>
          <Button
            disabled={!noFuturo || snooze.isPending}
            onClick={() =>
              quando &&
              snooze.mutate(
                { conversation_id: conversationId, snooze_until: quando.toISOString() },
                { onSuccess: aoFechar },
              )
            }
          >
            {t("Lembrar")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SnoozeButton({
  conversationId,
  snoozeUntil,
  disabled,
  variante = "botao",
  aoEscolherOutro,
  aoEscolher,
}: Props) {
  const t = useT();
  const { snooze, cancel } = useSnoozeConversation();
  const isActive = isSnoozeActive(snoozeUntil);
  const isPending = snooze.isPending || cancel.isPending;
  const [outroAberto, setOutroAberto] = useState(false);
  const abrirOutro = () => (aoEscolherOutro ? aoEscolherOutro() : setOutroAberto(true));

  if (variante === "lista") {
    const linha =
      "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm hover:bg-secondary disabled:opacity-60";
    return (
      <div className="grid gap-0.5" aria-label={t("Lembrar")}>
        <p className="px-2.5 pt-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {isActive ? t("Lembrete ativo") : t("Lembrar")}
        </p>
        {isActive ? (
          <button
            type="button"
            disabled={disabled || isPending}
            className={linha}
            onClick={() => {
              cancel.mutate({ conversation_id: conversationId });
              aoEscolher?.();
            }}
          >
            {t("Cancelar lembrete")}
          </button>
        ) : (
          <>
            {DURATIONS.map((d) => (
              <button
                key={d.hours}
                type="button"
                disabled={disabled || isPending}
                className={linha}
                onClick={() => {
                  snooze.mutate({ conversation_id: conversationId, duration_hours: d.hours });
                  aoEscolher?.();
                }}
              >
                {t(d.label)}
              </button>
            ))}
            <button
              type="button"
              disabled={disabled || isPending}
              className={linha}
              onClick={() => {
                abrirOutro();
                aoEscolher?.();
              }}
            >
              {t("Outro…")}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || isPending}
            className="flex items-center gap-1"
          >
            <Clock size={12} weight="regular" aria-hidden />
            {isActive ? t("Lembrete ativo") : t("Lembrar")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isActive ? (
            <DropdownMenuItem onClick={() => cancel.mutate({ conversation_id: conversationId })}>
              {t("Cancelar lembrete")}
            </DropdownMenuItem>
          ) : (
            <>
              {DURATIONS.map((d) => (
                <DropdownMenuItem
                  key={d.hours}
                  onClick={() =>
                    snooze.mutate({ conversation_id: conversationId, duration_hours: d.hours })
                  }
                >
                  {t(d.label)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => setOutroAberto(true)}>
                {t("Outro…")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <LembreteOutroDialog
        conversationId={conversationId}
        aberto={outroAberto}
        aoFechar={() => setOutroAberto(false)}
      />
    </>
  );
}
