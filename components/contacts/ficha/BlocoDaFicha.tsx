"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { BlocoRecolhivel } from "@/components/agenda/BlocoRecolhivel";

import { CaretDown, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type CorDoBloco =
  "blue" | "green" | "purple" | "orange" | "pink" | "yellow" | "gray" | "red";

const BARRA: Record<CorDoBloco, string> = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  purple: "border-l-purple-500",
  orange: "border-l-orange-500",
  pink: "border-l-pink-500",
  yellow: "border-l-yellow-500",
  gray: "border-l-gray-400",
  red: "border-l-red-500",
};

/**
 * Dentro deste contexto os blocos da ficha viram TOGGLES (o mesmo desenho dos campos da página da
 * oportunidade): fechados mostram só o título; a ação do bloco vai para dentro, no alto.
 */
export const BlocosEmToggle = createContext(false);

/**
 * O desenho do bloco: `barra` (o antigo, com a barra colorida na lateral), `cartao` (o cartão
 * simples da página da oportunidade, aberto) ou `toggle` (o mesmo cartão, que abre e fecha).
 */
export type EstiloDoBloco = "barra" | "cartao" | "toggle";
export const EstiloDosBlocos = createContext<EstiloDoBloco>("barra");

/** Um tópico da ficha: cartão com a barra colorida na lateral, título e (opcional) uma ação. */
export function BlocoDaFicha({
  titulo,
  cor = "blue",
  acao,
  recolhivel,
  children,
  className,
}: {
  titulo: string;
  cor?: CorDoBloco;
  acao?: ReactNode;
  /**
   * Bloco que abre e fecha: fechado mostra UMA linha (título, um texto curto e os selos); aberto
   * mostra tudo. Começa fechado.
   */
  recolhivel?: { texto: string; selos: ReactNode; abertoInicial?: boolean };
  children: ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState(recolhivel?.abertoInicial ?? false);
  const emToggleAntigo = useContext(BlocosEmToggle);
  const estilo = useContext(EstiloDosBlocos);
  const emToggle = emToggleAntigo || estilo === "toggle";
  if (estilo === "cartao" && !recolhivel && !emToggle) {
    return (
      <section
        className={cn(
          "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-border bg-card/50 p-3 sm:p-4",
          className,
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{titulo}</h3>
          {acao}
        </div>
        {children}
      </section>
    );
  }
  if (emToggle && !recolhivel) {
    return (
      <BlocoRecolhivel titulo={titulo}>
        {acao ? (
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">{acao}</div>
        ) : null}
        {children}
      </BlocoRecolhivel>
    );
  }
  if (recolhivel) {
    return (
      <section
        className={cn(
          "min-w-0 rounded-2xl border border-l-4 bg-card shadow-sm",
          BARRA[cor],
          className,
        )}
      >
        <button
          type="button"
          aria-expanded={aberto}
          onClick={() => setAberto((a) => !a)}
          className="flex w-full min-w-0 items-center gap-2 rounded-2xl px-4 py-3 text-left hover:bg-secondary/40"
        >
          {aberto ? (
            <CaretDown size={14} weight="bold" aria-hidden className="shrink-0" />
          ) : (
            <CaretRight size={14} weight="bold" aria-hidden className="shrink-0" />
          )}
          <span className="max-w-[40%] shrink-0 truncate text-sm font-semibold">{titulo}</span>
          <span
            className="min-w-0 flex-1 truncate text-sm text-muted-foreground"
            title={recolhivel.texto}
          >
            {recolhivel.texto}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">{recolhivel.selos}</span>
        </button>
        {aberto ? <div className="border-t p-4">{children}</div> : null}
      </section>
    );
  }
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-l-4 bg-card p-4 shadow-sm",
        BARRA[cor],
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Um par rótulo/valor da ficha. */
export function CampoLido({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </dt>
      <dd className="mt-0.5 text-sm break-words">{valor === null || valor === "" ? "—" : valor}</dd>
    </div>
  );
}

/** Uma etiqueta colorida pelo estado (Aberto, Ganho, Perdido…), com borda. */
export function SeloDaFicha({
  cor,
  children,
}: {
  cor: "blue" | "green" | "red" | "yellow" | "gray" | "purple";
  children: ReactNode;
}) {
  const classes = {
    blue: "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    green: "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-300",
    red: "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300",
    yellow: "border-yellow-500/60 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300",
    gray: "border-gray-400/60 bg-gray-500/10 text-muted-foreground",
    purple: "border-purple-500/60 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border-[1.5px] px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        classes[cor],
      )}
    >
      {children}
    </span>
  );
}
