"use client";

import { Check } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** A caixa de seleção: um clique alterna. Sem valor guardado, vale como desmarcada. */
export function CelulaDeCaixa({
  marcada,
  aoMudar,
  podeEditar,
  rotulo,
}: {
  marcada: boolean;
  aoMudar: (marcada: boolean) => void;
  podeEditar: boolean;
  rotulo: string;
}) {
  return (
    <div className="flex px-2 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={marcada}
        aria-label={rotulo}
        disabled={!podeEditar}
        onClick={() => aoMudar(!marcada)}
        className={cn(
          "grid h-5 w-5 place-items-center rounded-md border-2 transition-colors disabled:cursor-not-allowed",
          marcada
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border-strong hover:border-primary",
        )}
      >
        {marcada ? <Check size={12} weight="bold" aria-hidden /> : null}
      </button>
    </div>
  );
}
