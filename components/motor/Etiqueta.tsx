import type { ReactNode } from "react";

import { estiloDaEtiqueta } from "@/lib/motor/cores";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { cn } from "@/lib/utils";

/** A "pílula" colorida do Notion — status, prioridade, tags. */
export function Etiqueta({
  cor,
  children,
  className,
}: {
  cor: CorDaOpcao;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      style={estiloDaEtiqueta(cor)}
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-md px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}
