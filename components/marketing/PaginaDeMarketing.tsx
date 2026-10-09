import Link from "next/link";
import type { ReactNode } from "react";

import { Capa } from "@/components/marketing/Capa";
import { EtiquetaDeEstado } from "@/components/marketing/Cartoes";
import type { TomDaCapa } from "@/lib/marketing/modulos";
import { ArrowRight, CaretLeft } from "@/lib/ui/icons";

/**
 * O MOLDE das páginas de Marketing: capa grande com o título, e o conteúdo logo abaixo.
 * `voltar` leva ao painelzão (ou à página de cima).
 */
export function PaginaDeMarketing({
  tom,
  icone,
  superior,
  titulo,
  descricao,
  estado,
  voltar,
  children,
}: {
  tom: TomDaCapa;
  icone: ReactNode;
  /** A linha pequena acima do título (o nome da fase, ou "Marketing"). */
  superior: string;
  titulo: string;
  descricao: string;
  estado?: string;
  voltar: { href: string; rotulo: string };
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-4 sm:p-6">
      <Link
        href={voltar.href}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <CaretLeft size={14} aria-hidden />
        {voltar.rotulo}
      </Link>

      <Capa tom={tom} icone={icone} className="rounded-3xl">
        <div className="relative z-10 flex flex-col gap-3 p-6 sm:p-9">
          <span className="text-xs font-semibold tracking-wider uppercase opacity-80">
            {superior}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
            {estado ? <EtiquetaDeEstado texto={estado} /> : null}
          </div>
          <p className="max-w-2xl text-sm opacity-90 sm:text-base">{descricao}</p>
        </div>
      </Capa>

      {children}
    </div>
  );
}

/** Um atalho para uma tela que JÁ existe e se relaciona com esta página. */
export function Atalho({
  href,
  titulo,
  descricao,
}: {
  href: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block truncate text-xs text-muted-foreground">{descricao}</span>
      </span>
      <ArrowRight
        size={16}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

/** O bloco "o que vem aqui" das páginas ainda em construção. */
export function OQueVem({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold">{titulo}</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {itens.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
