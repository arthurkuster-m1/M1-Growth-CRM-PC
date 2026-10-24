"use client";

import { useState } from "react";

import { Etiqueta } from "@/components/motor/Etiqueta";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  tags: readonly string[];
  /** Tags que já existem nos outros leads, para escolher em vez de digitar. */
  sugestoes: readonly string[];
  podeEditar: boolean;
  rotulo: string;
  aoMudar: (tags: string[]) => void;
}

/**
 * As tags editáveis no lugar, como a "seleção múltipla" do Notion: a célula mostra as
 * etiquetas; abrir o painel deixa tirar, escolher entre as que já existem ou criar uma nova.
 */
export function CelulaDeEtiquetas({ tags, sugestoes, podeEditar, rotulo, aoMudar }: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");

  const adicionar = (bruta: string) => {
    const nova = bruta.trim();
    if (!nova) return;
    if (!tags.some((x) => x.toLowerCase() === nova.toLowerCase())) aoMudar([...tags, nova]);
    setTexto("");
  };
  const termo = texto.trim().toLowerCase();
  const livres = sugestoes
    .filter((s) => !tags.includes(s) && (termo === "" || s.toLowerCase().includes(termo)))
    .slice(0, 8);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!podeEditar}
          aria-label={rotulo}
          className={cn(
            "flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded-md px-2 py-1 text-left",
            podeEditar && "hover:bg-secondary",
          )}
        >
          {tags.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            tags.map((x) => (
              <Etiqueta key={x} cor="gray">
                {x}
              </Etiqueta>
            ))
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="flex flex-wrap gap-1 pb-2">
          {tags.map((x) => (
            <button
              key={x}
              type="button"
              aria-label={`${t("Tirar")} ${x}`}
              onClick={() => aoMudar(tags.filter((y) => y !== x))}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs hover:bg-secondary/70"
            >
              {x}
              <X size={10} weight="bold" aria-hidden />
            </button>
          ))}
        </div>
        <input
          value={texto}
          autoFocus
          maxLength={40}
          placeholder={t("Digite e aperte Enter")}
          aria-label={t("Nova tag")}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar(texto);
            }
          }}
          className="h-8 w-full rounded-lg border bg-card px-2 text-sm outline-hidden focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
        {livres.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {livres.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => adicionar(s)}
                className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                + {s}
              </button>
            ))}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
