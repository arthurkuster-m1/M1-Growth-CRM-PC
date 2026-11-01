"use client";

import type { ReactNode } from "react";

import { useT } from "@/hooks/i18n/useT";
import type { PassoDaRegra } from "@/lib/automation/passos-da-regra";
import { Funnel, Lightning, Play } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const ESTILO: Record<PassoDaRegra["tipo"], { cor: string; icone: ReactNode; rotulo: string }> = {
  gatilho: {
    cor: "bg-primary/15 text-primary",
    icone: <Lightning size={14} weight="fill" aria-hidden />,
    rotulo: "Quando",
  },
  condicao: {
    cor: "bg-warning-bg text-warning-fg",
    icone: <Funnel size={14} aria-hidden />,
    rotulo: "Se",
  },
  acao: {
    cor: "bg-success-bg text-success-fg",
    icone: <Play size={14} weight="fill" aria-hidden />,
    rotulo: "Então",
  },
};

/**
 * A regra vista como FLUXO, em coluna: Quando → Se → Então. Funciona no celular (sem arrastar) e é só
 * leitura: editar continua no editor da regra.
 */
export function FluxoVertical({ passos }: { passos: PassoDaRegra[] }) {
  const t = useT();
  return (
    <ol className="grid gap-0" data-testid="fluxo-vertical">
      {passos.map((p, i) => {
        const e = ESTILO[p.tipo];
        const ultimo = i === passos.length - 1;
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", e.cor)}>
                {e.icone}
              </span>
              {ultimo ? null : <span className="my-0.5 w-px flex-1 bg-border" aria-hidden />}
            </div>
            <div className={cn("min-w-0 flex-1", ultimo ? "pb-0" : "pb-3")}>
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t(e.rotulo)}
              </p>
              <p className="text-sm font-medium [overflow-wrap:anywhere]">{t(p.titulo)}</p>
              {p.detalhe ? (
                <p className="text-xs [overflow-wrap:anywhere] text-muted-foreground">
                  {p.detalhe}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
