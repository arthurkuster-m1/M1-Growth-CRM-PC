"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { abreviarNumeroGrande } from "@/lib/formatar/numero-que-cabe";
import { cn } from "@/lib/utils";

const ESCALA_MINIMA = 0.45;

/**
 * O número de um cartão de painel, sempre INTEIRO e em UMA linha: sem quebrar ("R$" em cima,
 * "1.500,00" embaixo) e sem reticências. A fonte herdada do pai encolhe até o texto caber; de 1
 * milhão para cima o número é abreviado ("3,5 mi"). Dê ao pai o tamanho de fonte (`text-xl`…).
 */
export function NumeroQueCabe({
  children,
  className,
  abreviar = true,
}: {
  children: string;
  className?: string;
  abreviar?: boolean;
}) {
  const texto = abreviar ? abreviarNumeroGrande(children) : children;
  const caixa = useRef<HTMLSpanElement>(null);
  const miolo = useRef<HTMLSpanElement>(null);
  const escalaAtual = useRef(1);
  const [escala, setEscala] = useState(1);

  useLayoutEffect(() => {
    const c = caixa.current;
    const m = miolo.current;
    if (!c || !m) return;
    const medir = () => {
      const disponivel = c.clientWidth;
      const natural = m.scrollWidth / escalaAtual.current;
      if (!disponivel || !natural) return;
      const proxima = Math.max(ESCALA_MINIMA, Math.min(1, (disponivel - 1) / natural));
      if (Math.abs(proxima - escalaAtual.current) < 0.005) return;
      escalaAtual.current = proxima;
      setEscala(proxima);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(c);
    return () => obs.disconnect();
  }, [texto]);

  return (
    <span ref={caixa} className={cn("block w-full min-w-0 overflow-hidden whitespace-nowrap", className)}>
      <span ref={miolo} className="inline-block" style={{ fontSize: `${escala}em` }}>
        {texto}
      </span>
    </span>
  );
}
