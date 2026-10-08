"use client";

import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

interface Props {
  /** `AAAA-MM-DD`, ou `null` para "sem data". */
  valor: string | null;
  tag: string;
  aoSalvar: (dia: string | null) => void;
  podeEditar: boolean;
  rotulo: string;
}

/**
 * Uma data SEM hora (a propriedade "Data"). Diferente do prazo da tarefa, que é um instante
 * no fuso da organização, o dia é só o dia: "entrega em 8/10" não muda por causa de fuso, e
 * guardar `AAAA-MM-DD` evita que mude.
 */
export function CelulaDeDia({ valor, tag, aoSalvar, podeEditar, rotulo }: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState("");

  function abrirOuFechar(abrir: boolean) {
    if (abrir) setRascunho(valor ?? "");
    else if ((rascunho || null) !== valor) aoSalvar(rascunho || null);
    setAberto(abrir);
  }

  const texto = valor
    ? new Intl.DateTimeFormat(tag, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${valor}T12:00:00Z`))
    : t("Vazio");

  return (
    <Popover open={aberto} onOpenChange={abrirOuFechar}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!podeEditar}
          aria-label={rotulo}
          className={cn(
            "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm",
            podeEditar && "hover:bg-secondary",
            !valor && "text-text-subtle",
          )}
        >
          {texto}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-2 p-3">
        <input
          type="date"
          aria-label={rotulo}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") abrirOuFechar(false);
          }}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => setRascunho("")}
          className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {t("Limpar")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
