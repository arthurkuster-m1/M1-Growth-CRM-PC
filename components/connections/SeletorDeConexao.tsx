"use client";

import type { ComponentType } from "react";

import { IconeDoCartao, type TomVisual } from "@/components/marketing/campanhas/visual/Pecas";
import { cn } from "@/lib/utils";

type Icone = ComponentType<{
  size?: number;
  weight?: "duotone" | "bold" | "regular";
  className?: string;
}>;

export interface OpcaoDeConexao {
  id: string;
  icone: Icone;
  tom: TomVisual;
  titulo: string;
  descricao: string;
  /** Uma etiqueta de estado, quando a tela já sabe (ex.: "Conectada"). */
  estado?: { texto: string; bom: boolean } | null;
}

/**
 * O SELETOR de conexões: um cartão por tipo (ícone colorido, nome e uma linha do que faz), no
 * lugar da fila de abas. O escolhido fica destacado; no celular os cartões rolam para o lado.
 */
export function SeletorDeConexao({
  opcoes,
  ativa,
  aoEscolher,
  rotulo,
}: {
  opcoes: readonly OpcaoDeConexao[];
  ativa: string;
  aoEscolher: (id: string) => void;
  rotulo: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className="-mx-4 flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 xl:grid-cols-6 [&::-webkit-scrollbar]:hidden"
    >
      {opcoes.map((o) => {
        const escolhida = o.id === ativa;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            id={`conexao-aba-${o.id}`}
            aria-selected={escolhida}
            onClick={() => aoEscolher(o.id)}
            className={cn(
              "group flex min-w-[13.5rem] shrink-0 snap-start flex-col gap-2 rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-all sm:min-w-0",
              "hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden",
              escolhida
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "hover:border-primary/40",
            )}
          >
            <span className="flex items-start justify-between gap-2">
              <IconeDoCartao icone={o.icone} tom={o.tom} className="h-9 w-9" />
              {o.estado ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    o.estado.bom
                      ? "bg-success-bg text-success-fg"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {o.estado.texto}
                </span>
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{o.titulo}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                {o.descricao}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
