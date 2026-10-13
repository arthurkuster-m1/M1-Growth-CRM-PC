"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type CorDoBloco = "blue" | "green" | "purple" | "orange" | "pink" | "yellow" | "gray" | "red";

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

/** Um tópico da ficha: cartão com a barra colorida na lateral, título e (opcional) uma ação. */
export function BlocoDaFicha({
  titulo,
  cor = "blue",
  acao,
  children,
  className,
}: {
  titulo: string;
  cor?: CorDoBloco;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("min-w-0 rounded-2xl border border-l-4 bg-card p-4 shadow-sm", BARRA[cor], className)}
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
