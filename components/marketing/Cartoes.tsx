import Link from "next/link";
import type { ReactNode } from "react";

import { Capa } from "@/components/marketing/Capa";
import type { TomDaCapa } from "@/lib/marketing/modulos";
import { BASE_DA_COR } from "@/lib/motor/cores";
import { ArrowRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** "Em breve" / "Publicado": o estado de uma página de Marketing. */
export function EtiquetaDeEstado({ texto, ativo }: { texto: string; ativo?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        ativo ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
      )}
    >
      {texto}
    </span>
  );
}

/** Um CARTÃO GRANDE do painelzão: uma área inteira de Marketing (Estratégia, Dashboards…). */
export function CartaoDeArea({
  href,
  tom,
  icone,
  titulo,
  descricao,
  estado,
  abrir,
}: {
  href: string;
  tom: TomDaCapa;
  icone: ReactNode;
  titulo: string;
  descricao: string;
  /** Ausente = sem etiqueta (ex.: página já publicada). */
  estado?: string | null;
  /** "Abrir" já traduzido. */
  abrir: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden"
    >
      <Capa tom={tom} icone={icone} className="h-36">
        <span className="absolute top-4 left-4 grid h-11 w-11 place-items-center rounded-2xl bg-white/20 text-white backdrop-blur-sm [&>svg]:h-6 [&>svg]:w-6">
          {icone}
        </span>
      </Capa>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{titulo}</h3>
          {estado ? <EtiquetaDeEstado texto={estado} /> : null}
        </div>
        <p className="text-sm text-muted-foreground">{descricao}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium text-primary">
          {abrir}
          <ArrowRight
            size={14}
            weight="bold"
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}

/** Um cartão de MÓDULO da galeria (estilo "Profile do Cliente"): capa, ícone, título e a fase. */
export function CartaoDeModulo({
  href,
  tom,
  icone,
  titulo,
  fase,
  estado,
}: {
  href: string;
  tom: TomDaCapa;
  icone: ReactNode;
  titulo: string;
  fase: string;
  /** Ausente = sem etiqueta (ex.: página já publicada). */
  estado?: string | null;
}) {
  const base = BASE_DA_COR[tom];
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden"
    >
      <Capa tom={tom} icone={icone} className="h-24" />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center gap-2">
          <span style={{ color: base }} className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {icone}
          </span>
          <h4 className="text-sm leading-snug font-medium">{titulo}</h4>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span
            style={{
              backgroundColor: `color-mix(in srgb, ${base} 16%, transparent)`,
              color: `color-mix(in srgb, ${base} 70%, var(--color-text, currentColor))`,
            }}
            className="truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium"
          >
            {fase}
          </span>
          {estado ? <EtiquetaDeEstado texto={estado} /> : null}
        </div>
      </div>
    </Link>
  );
}
