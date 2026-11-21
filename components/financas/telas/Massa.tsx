"use client";

import { ListMagnifyingGlass } from "@/lib/ui/icons";

import { EmptyState } from "../kit";

/** O lançamento em massa (planilha/CSV) é a fase F8; até lá esta vista só avisa. */
export function Massa() {
  return (
    <EmptyState icon={<ListMagnifyingGlass size={28} />} title="Lançar em massa chega em breve">
      Colar da planilha e importar CSV entram numa próxima etapa.
    </EmptyState>
  );
}
