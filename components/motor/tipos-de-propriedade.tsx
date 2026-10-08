import type { ReactNode } from "react";

import type { TipoDePropriedade } from "@/lib/tarefas/propriedades";
import {
  CalendarBlank,
  CheckSquare,
  Hash,
  LinkSimple,
  ListChecks,
  Tag,
  TextAa,
} from "@/lib/ui/icons";

/** O ícone de cada tipo de propriedade — o mesmo no cabeçalho, no menu e no seletor de tipo. */
export function iconeDoTipo(tipo: TipoDePropriedade, tamanho = 14): ReactNode {
  switch (tipo) {
    case "text":
      return <TextAa size={tamanho} aria-hidden />;
    case "number":
      return <Hash size={tamanho} aria-hidden />;
    case "select":
      return <Tag size={tamanho} aria-hidden />;
    case "multi_select":
      return <ListChecks size={tamanho} aria-hidden />;
    case "date":
      return <CalendarBlank size={tamanho} aria-hidden />;
    case "checkbox":
      return <CheckSquare size={tamanho} aria-hidden />;
    case "url":
      return <LinkSimple size={tamanho} aria-hidden />;
  }
}

/**
 * O nome de cada tipo. Um `switch` com `t()` literal em cada ramo, e não um mapa de
 * textos: é o que deixa o teste de tradução ler cada frase.
 */
export function rotuloDoTipo(t: (texto: string) => string, tipo: TipoDePropriedade): string {
  switch (tipo) {
    case "text":
      return t("Texto");
    case "number":
      return t("Número");
    case "select":
      return t("Seleção");
    case "multi_select":
      return t("Seleção múltipla");
    case "date":
      return t("Data");
    case "checkbox":
      return t("Caixa de seleção");
    case "url":
      return t("Link");
  }
}

/** A largura de fábrica da coluna de cada tipo, em px. */
export const LARGURA_DO_TIPO: Record<TipoDePropriedade, number> = {
  text: 200,
  number: 120,
  select: 180,
  multi_select: 240,
  date: 150,
  checkbox: 110,
  url: 220,
};
