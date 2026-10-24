"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";

import { Check } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Algumas (não todas) marcadas: mostra o traço no meio. */
  parcial?: boolean;
}

/**
 * A caixa de marcar do sistema: REDONDA (como as da tabela), com o visto por dentro. É o
 * `<input type="checkbox">` de verdade por baixo, então rótulo, teclado e leitor de tela
 * funcionam como sempre.
 */
export function CaixaRedonda({ parcial = false, className, ...resto }: Props) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = parcial;
  }, [parcial]);
  return (
    <span
      className={cn(
        "relative inline-grid h-[18px] w-[18px] shrink-0 place-items-center",
        className,
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-full border-2 border-border-strong bg-background transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        {...resto}
      />
      <Check
        size={11}
        weight="bold"
        aria-hidden
        className="pointer-events-none relative hidden text-primary-foreground peer-checked:block peer-indeterminate:hidden"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute hidden h-0.5 w-2 rounded-sm bg-primary-foreground peer-indeterminate:block"
      />
    </span>
  );
}
