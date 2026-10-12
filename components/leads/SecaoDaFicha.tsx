"use client";

import { useState, type ReactNode } from "react";

import { CaretDown, CaretRight } from "@/lib/ui/icons";

function lerAberta(id: string, padrao: boolean): boolean {
  try {
    const v = window.localStorage.getItem(`ficha-secao:${id}`);
    return v === null ? padrao : v === "1";
  } catch {
    return padrao;
  }
}

/**
 * Um tópico da ficha do lead, em toggle: abre e fecha com um toque, e lembra como a pessoa
 * deixou (por tópico, neste navegador).
 */
export function SecaoDaFicha({
  id,
  titulo,
  resumo,
  padraoAberta = true,
  children,
}: {
  id: string;
  titulo: string;
  /** Texto curto ao lado do título (contagem, estado) — aparece também fechado. */
  resumo?: ReactNode;
  padraoAberta?: boolean;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(() =>
    typeof window === "undefined" ? padraoAberta : lerAberta(id, padraoAberta),
  );
  function alternar() {
    const proximo = !aberta;
    setAberta(proximo);
    try {
      window.localStorage.setItem(`ficha-secao:${id}`, proximo ? "1" : "0");
    } catch {
      // sem armazenamento: só não lembra
    }
  }
  const Seta = aberta ? CaretDown : CaretRight;
  return (
    <section className="border-b border-border py-2">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberta}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-secondary/50"
      >
        <Seta size={14} weight="bold" aria-hidden className="shrink-0 text-text-muted" />
        <span className="text-xs font-medium tracking-wide text-text-muted uppercase">
          {titulo}
        </span>
        {resumo ? <span className="ml-auto truncate text-xs text-text-muted">{resumo}</span> : null}
      </button>
      {aberta ? <div className="px-1 pt-2 pb-1">{children}</div> : null}
    </section>
  );
}
