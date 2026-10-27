"use client";

import * as React from "react";

import { CaretDown } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** Um bloco que abre e fecha ao clicar no título. Fechado por padrão: a configuração fica limpa. */
export function BlocoRecolhivel({
  titulo,
  resumo,
  children,
  inicialmenteAberto = false,
  grande = false,
  icone,
  id,
}: {
  titulo: React.ReactNode;
  /** Texto curto ao lado do título, visível também fechado. */
  resumo?: React.ReactNode;
  children: React.ReactNode;
  inicialmenteAberto?: boolean;
  /** O bloco principal (título maior, mais espaço). */
  grande?: boolean;
  icone?: React.ReactNode;
  id?: string;
}) {
  const [aberto, setAberto] = React.useState(inicialmenteAberto);
  const corpoId = React.useId();
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 max-w-full rounded-2xl border border-border bg-surface",
        grande && "rounded-3xl",
      )}
    >
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={corpoId}
        onClick={() => setAberto((a) => !a)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-secondary/50",
          grande && "rounded-3xl px-5 py-4",
        )}
      >
        {icone}
        <span className="min-w-0 flex-1">
          <span className={cn("block font-semibold", grande ? "text-lg" : "text-sm")}>{titulo}</span>
          {resumo ? <span className="block text-xs text-muted-foreground">{resumo}</span> : null}
        </span>
        <CaretDown size={18} weight="bold" aria-hidden className={cn("shrink-0 transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto ? (
        <div id={corpoId} className={cn("min-w-0 border-t border-border p-4", grande && "p-5")}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
