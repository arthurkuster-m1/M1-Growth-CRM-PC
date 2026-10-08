"use client";

import { useEffect, useState } from "react";

const CONSULTA = "(max-width: 767px)";

/**
 * `true` em tela de celular (abaixo de `md`, o mesmo corte da casca). No servidor e na
 * primeira pintura vale `false`: a tela de computador é o padrão seguro, e o celular troca
 * logo depois da hidratação.
 */
export function useCelular(): boolean {
  const [celular, setCelular] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(CONSULTA);
    const ler = () => setCelular(m.matches);
    ler();
    m.addEventListener("change", ler);
    return () => m.removeEventListener("change", ler);
  }, []);
  return celular;
}
