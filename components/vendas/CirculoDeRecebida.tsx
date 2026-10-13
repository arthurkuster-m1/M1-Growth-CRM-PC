"use client";

import { Check } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** O círculo de "recebida": uma bolinha que se preenche com o visto (no lugar da caixinha quadrada). */
export function CirculoDeRecebida({
  marcado,
  rotulo,
  aoMudar,
  desabilitado,
  className,
}: {
  marcado: boolean;
  rotulo: string;
  aoMudar: (v: boolean) => void;
  desabilitado?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcado}
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={() => aoMudar(!marcado)}
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-40",
        marcado
          ? "border-green-600 bg-green-600 text-white"
          : "border-muted-foreground/50 hover:border-green-600",
        className,
      )}
    >
      {marcado ? <Check size={12} weight="bold" aria-hidden /> : null}
    </button>
  );
}
