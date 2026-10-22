import Link from "next/link";
import type { ReactNode } from "react";

import { CaretLeft } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * O "VOLTAR" do app — um desenho só, em toda tela (ver a página Design System).
 *
 * Pílula arredondada com a seta e o destino ("Voltar para Usuários"). Com `href` é um link;
 * com `aoClicar`, um botão (voltar dentro da própria tela). Sem `children`, só "Voltar".
 */
export const CLASSE_DO_VOLTAR =
  "inline-flex h-9 w-fit max-w-full shrink-0 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium whitespace-nowrap text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground";

export function LinkVoltar({
  href,
  aoClicar,
  children,
  className,
}: {
  href?: string;
  aoClicar?: () => void;
  /** O destino, já traduzido: "Usuários" vira "Voltar para Usuários". */
  children?: ReactNode;
  className?: string;
}) {
  const conteudo = (
    <>
      <CaretLeft size={14} weight="bold" aria-hidden />
      <span className="truncate">{children ? <>Voltar para {children}</> : "Voltar"}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cn(CLASSE_DO_VOLTAR, className)}>
        {conteudo}
      </Link>
    );
  }
  return (
    <button type="button" onClick={aoClicar} className={cn(CLASSE_DO_VOLTAR, className)}>
      {conteudo}
    </button>
  );
}
