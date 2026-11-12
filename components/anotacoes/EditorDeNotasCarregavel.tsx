"use client";

import dynamic from "next/dynamic";

/**
 * O editor é pesado (editor de texto + interface própria): só baixa quando a pessoa abre uma página
 * de anotação, e nunca é desenhado no servidor.
 */
export const EditorDeNotasCarregavel = dynamic(
  () => import("@/components/anotacoes/EditorDeNotas"),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-3xl bg-secondary" aria-busy="true" />,
  },
);
