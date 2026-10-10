import Link from "next/link";
import { Fragment } from "react";

import { CaretLeft, CaretRight } from "@/lib/ui/icons";

export interface PassoDaTrilha {
  rotulo: string;
  /** Ausente no passo atual (a página em que a pessoa está). */
  href?: string;
}

/**
 * A NAVEGAÇÃO do link público: um botão "Voltar" bem visível e a trilha de onde a pessoa está
 * (Marketing › Módulo › Página), cada passo clicável. Sem login, é o único jeito de se
 * orientar; por isso fica no topo de toda página, inclusive no celular.
 */
export function NavegacaoPublica({
  voltar,
  trilha,
  rotulo,
}: {
  voltar?: { href: string; rotulo: string };
  trilha: PassoDaTrilha[];
  /** O nome da navegação para leitores de tela (já traduzido). */
  rotulo: string;
}) {
  if (!voltar && trilha.length <= 1) return null;
  return (
    <nav aria-label={rotulo} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {voltar ? (
        <Link
          href={voltar.href}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border-[1.5px] border-primary bg-card px-3.5 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/10"
        >
          <CaretLeft size={14} weight="bold" aria-hidden />
          {voltar.rotulo}
        </Link>
      ) : null}
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {trilha.map((passo, i) => (
          <Fragment key={i}>
            {i > 0 ? <CaretRight size={12} aria-hidden className="shrink-0" /> : null}
            <li className="min-w-0">
              {passo.href ? (
                <Link href={passo.href} className="truncate hover:text-foreground hover:underline">
                  {passo.rotulo}
                </Link>
              ) : (
                <span aria-current="page" className="truncate font-medium text-foreground">
                  {passo.rotulo}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
