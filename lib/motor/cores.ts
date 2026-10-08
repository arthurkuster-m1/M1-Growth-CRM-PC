import type { CSSProperties } from "react";

import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";

/**
 * As cores das etiquetas do motor (status, prioridade, tags) — a paleta do Notion.
 *
 * Cada cor é UMA cor-base; o fundo e o texto saem dela por `color-mix` contra os
 * tokens do tema. Assim a mesma etiqueta fica legível no claro e no escuro sem
 * duas tabelas de hex, e a cor da marca (white-label) não interfere: etiqueta de
 * status é dado da organização, não identidade visual.
 */
export const BASE_DA_COR: Record<CorDaOpcao, string> = {
  gray: "#6b7684",
  brown: "#9a6b4b",
  orange: "#e0802b",
  yellow: "#cfa012",
  green: "#3f9a63",
  blue: "#3b78d8",
  purple: "#8a5cd0",
  pink: "#d0589a",
  red: "#d24d4d",
};

/** Os nomes das cores como a tela os mostra — passam por `t()` no componente. */
export const ROTULO_DA_COR: Record<CorDaOpcao, string> = {
  gray: "Cinza",
  brown: "Marrom",
  orange: "Laranja",
  yellow: "Amarelo",
  green: "Verde",
  blue: "Azul",
  purple: "Roxo",
  pink: "Rosa",
  red: "Vermelho",
};

export function estiloDaEtiqueta(cor: CorDaOpcao): CSSProperties {
  const base = BASE_DA_COR[cor];
  return {
    backgroundColor: `color-mix(in oklab, ${base} 20%, var(--color-surface))`,
    color: `color-mix(in oklab, ${base} 78%, var(--color-text))`,
  };
}

/** A bolinha de cor (o "ponto" do seletor de cores). */
export function estiloDoPonto(cor: CorDaOpcao): CSSProperties {
  return { backgroundColor: BASE_DA_COR[cor] };
}
