"use client";

import dynamic from "next/dynamic";

/** O React Flow é pesado: só baixa quando uma página tem canvas (e nunca é desenhado no servidor). */
export const CanvasVisualizacao = dynamic(
  () => import("@/components/marketing/canvas/CanvasVisualizacao"),
  {
    ssr: false,
    loading: () => <div className="h-40 animate-pulse rounded-2xl bg-secondary" aria-busy="true" />,
  },
);

export const EditorDeCanvas = dynamic(
  () => import("@/components/marketing/canvas/EditorDeCanvas"),
  {
    ssr: false,
  },
);
