"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { Plus } from "@/lib/ui/icons";

export interface ItemOculto {
  chave: string;
  rotulo: string;
  tipo: "fase" | "pagina" | "atalho";
}

/**
 * "Adicionar página": traz de volta o que foi ocultado ou apagado — fases inteiras, páginas e
 * atalhos. O que foi só ocultado volta como estava; o que teve o conteúdo apagado volta do zero.
 */
export function AdicionarPagina({ itens }: { itens: ItemOculto[] }) {
  const t = useT();
  const router = useRouter();
  const [trabalhando, setTrabalhando] = useState(false);

  async function mostrar(chave: string) {
    setTrabalhando(true);
    try {
      await apiClient.post("/api/v1/marketing/estrategia/ocultas", { chave, acao: "mostrar" });
      router.refresh();
    } catch (e) {
      showApiError(e);
    } finally {
      setTrabalhando(false);
    }
  }

  const grupo = (tipo: ItemOculto["tipo"], titulo: string) => {
    const lista = itens.filter((i) => i.tipo === tipo);
    if (lista.length === 0) return null;
    return (
      <>
        <DropdownMenuLabel className="text-[11px] tracking-wide text-muted-foreground uppercase">
          {titulo}
        </DropdownMenuLabel>
        {lista.map((i) => (
          <DropdownMenuItem
            key={i.chave}
            disabled={trabalhando}
            onSelect={() => void mostrar(i.chave)}
          >
            <Plus size={13} weight="bold" aria-hidden className="mr-2" />
            {i.rotulo}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
      </>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="adicionar-pagina"
          className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-secondary"
        >
          <Plus size={14} weight="bold" aria-hidden />
          {t("Adicionar página")}
          {itens.length > 0 ? (
            <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
              {itens.length}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-72 overflow-y-auto">
        {itens.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            {t("Nenhuma página oculta. Use o menu ⋯ de uma página para ocultar ou apagar.")}
          </p>
        ) : (
          <>
            <p className="px-2 pb-1 text-xs text-muted-foreground">
              {t(
                "Páginas ocultas ou apagadas. O que foi só ocultado volta como estava; o que foi apagado volta do zero.",
              )}
            </p>
            <DropdownMenuSeparator />
            {grupo("fase", t("Fases inteiras"))}
            {grupo("pagina", t("Páginas"))}
            {grupo("atalho", t("Atalhos do topo"))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
