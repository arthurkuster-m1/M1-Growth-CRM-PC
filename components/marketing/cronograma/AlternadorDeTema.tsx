"use client";

import type { TemaDoCronograma } from "@/components/marketing/cronograma/PainelDoCronograma";
import { cn } from "@/lib/utils";

/** Claro | Escuro: vale para a tela e para a imagem baixada. */
export function AlternadorDeTema({
  tema,
  aoMudar,
  rotulo,
  claro,
  escuro,
}: {
  tema: TemaDoCronograma;
  aoMudar: (t: TemaDoCronograma) => void;
  rotulo: string;
  claro: string;
  escuro: string;
}) {
  return (
    <div role="group" aria-label={rotulo} className="inline-flex rounded-xl bg-secondary p-0.5">
      {(
        [
          ["claro", claro],
          ["escuro", escuro],
        ] as const
      ).map(([valor, texto]) => (
        <button
          key={valor}
          type="button"
          aria-pressed={tema === valor}
          onClick={() => aoMudar(valor)}
          className={cn(
            "h-8 rounded-[10px] px-3 text-sm font-medium transition-colors",
            tema === valor
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}
