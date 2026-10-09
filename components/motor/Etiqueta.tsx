import type { ReactNode } from "react";

import { BASE_DA_COR, estiloDaEtiqueta } from "@/lib/motor/cores";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { cn } from "@/lib/utils";

/** A "pílula" colorida do Notion — status, prioridade, tags. */
export function Etiqueta({
  cor,
  children,
  className,
  ponto = false,
}: {
  cor: CorDaOpcao;
  children: ReactNode;
  className?: string;
  /** O pontinho colorido antes do nome — o jeito do Notion para a propriedade Status. */
  ponto?: boolean;
}) {
  return (
    <span
      style={estiloDaEtiqueta(cor)}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-0.5 text-xs font-medium max-md:py-1 max-md:text-sm",
        className,
      )}
    >
      {ponto ? (
        <span
          aria-hidden
          style={{ backgroundColor: BASE_DA_COR[cor] }}
          className="h-2 w-2 shrink-0 rounded-full"
        />
      ) : null}
      {children}
    </span>
  );
}
