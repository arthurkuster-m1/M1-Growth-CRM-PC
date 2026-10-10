"use client";

import { formatarMoeda } from "@/lib/marketing/calculadora";

/**
 * Campo de VALOR em reais: ao digitar, vira R$ 0,00 sozinho (os dígitos entram pela direita,
 * como na maquininha). O valor guardado é o texto já formatado ("R$ 1.500,00"), que a
 * calculadora entende.
 */
export function CampoDeMoeda({
  valor,
  aoMudar,
  className,
  ariaLabel,
  placeholder = "R$ 0,00",
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  return (
    <input
      value={valor}
      inputMode="numeric"
      maxLength={24}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => aoMudar(formatarMoeda(e.target.value))}
      className={className}
    />
  );
}
