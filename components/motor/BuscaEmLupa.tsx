"use client";

import { useEffect, useRef, useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { MagnifyingGlass, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  valor: string;
  aoMudar: (valor: string) => void;
  placeholder: string;
}

/**
 * A BUSCA em lupa, como no Notion: um ícone pequeno na fila das visualizações. Tocar abre o campo
 * no próprio lugar; com texto escrito a lupa fica AZUL e o campo não fecha sozinho; vazio, ele
 * volta a ser só o ícone ao perder o foco ou com Esc.
 */
export function BuscaEmLupa({ valor, aoMudar, placeholder }: Props) {
  const t = useT();
  const [aberta, setAberta] = useState(false);
  const campo = useRef<HTMLInputElement | null>(null);
  const visivel = aberta || valor !== "";

  useEffect(() => {
    if (aberta) campo.current?.focus();
  }, [aberta]);

  if (!visivel) {
    return (
      <button
        type="button"
        aria-label={t("Buscar")}
        title={t("Buscar")}
        onClick={() => setAberta(true)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <MagnifyingGlass size={16} aria-hidden />
      </button>
    );
  }

  return (
    <label className="relative flex h-8 shrink-0 items-center">
      <span className="sr-only">{placeholder}</span>
      <MagnifyingGlass
        size={14}
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-2",
          valor ? "text-primary" : "text-muted-foreground",
        )}
      />
      <input
        ref={campo}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => aoMudar(e.target.value)}
        onBlur={() => {
          if (valor === "") setAberta(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            aoMudar("");
            setAberta(false);
          }
        }}
        className="h-8 w-24 rounded-lg border bg-card pr-7 pl-7 text-sm outline-hidden focus:border-primary/50 focus:ring-2 focus:ring-primary/20 sm:w-56"
      />
      {valor ? (
        <button
          type="button"
          aria-label={t("Limpar busca")}
          title={t("Limpar busca")}
          onClick={() => {
            aoMudar("");
            setAberta(false);
          }}
          className="absolute right-1.5 grid h-5 w-5 place-items-center rounded text-muted-foreground hover:text-foreground"
        >
          <X size={12} aria-hidden />
        </button>
      ) : null}
    </label>
  );
}
