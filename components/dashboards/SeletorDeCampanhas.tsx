"use client";

import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { CaretDown, Megaphone } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * O SELETOR DE CAMPANHAS: um botão em pílula (como o seletor de período) que abre a lista com
 * busca e caixinhas — uma, várias ou todas.
 */
export function SeletorDeCampanhas({
  catalogo,
  escolhidas,
  aoMudar,
}: {
  catalogo: Array<{ id: string; nome: string }>;
  escolhidas: string[];
  aoMudar: (ids: string[]) => void;
}) {
  const t = useT();
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const lista = catalogo.filter((c) => termo === "" || c.nome.toLowerCase().includes(termo));
  const alternar = (id: string) =>
    aoMudar(escolhidas.includes(id) ? escolhidas.filter((x) => x !== id) : [...escolhidas, id]);
  const rotulo =
    escolhidas.length === 0
      ? t("Todas as campanhas")
      : escolhidas.length === 1
        ? (catalogo.find((c) => c.id === escolhidas[0])?.nome ?? t("1 campanha"))
        : `${escolhidas.length} ${t("campanhas")}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("Campanhas")}
          className={cn(
            "inline-flex h-11 max-w-full items-center gap-2 rounded-full border bg-secondary/60 px-4 text-sm font-medium transition-colors hover:bg-secondary",
            escolhidas.length > 0 && "border-primary bg-primary/10",
          )}
        >
          <Megaphone size={15} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="max-w-[16rem] truncate">{rotulo}</span>
          <CaretDown size={13} weight="bold" aria-hidden className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="max-h-[var(--radix-popover-content-available-height)] w-[min(94vw,380px)] overflow-y-auto overscroll-contain p-3"
      >
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={t("Buscar campanha")}
          className="mb-2 h-10 w-full rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60"
        />
        <button
          type="button"
          onClick={() => aoMudar([])}
          className={cn(
            "mb-1 flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-secondary",
            escolhidas.length === 0 && "bg-secondary font-medium",
          )}
        >
          {t("Todas as campanhas")}
          <span className="text-xs text-muted-foreground">{catalogo.length}</span>
        </button>
        <div className="grid gap-0.5">
          {lista.map((c) => {
            const marcada = escolhidas.includes(c.id);
            return (
              <label
                key={c.id}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm hover:bg-secondary",
                  marcada && "bg-primary/10",
                )}
              >
                <input
                  type="checkbox"
                  checked={marcada}
                  onChange={() => alternar(c.id)}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{c.nome}</span>
              </label>
            );
          })}
          {lista.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {t("Nenhuma campanha encontrada.")}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
