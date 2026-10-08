"use client";

import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { deCampoLocal, paraCampoLocal, rotuloDaData } from "@/lib/motor/datas-do-campo";
import { cn } from "@/lib/utils";

interface Props {
  /** ISO com fuso, ou `null` para "sem data". */
  valor: string | null;
  fuso: string;
  tag: string;
  agora: Date;
  aoSalvar: (iso: string | null) => void;
  podeEditar: boolean;
  /** Vermelho: o prazo passou e a tarefa não foi encerrada. */
  atrasada?: boolean;
  rotulo: string;
}

/**
 * A data da célula. Clicou, abre o seletor de data e hora; ao fechar (ou Enter) salva.
 * A hora é a do relógio da ORGANIZAÇÃO (`fuso`), nunca a do navegador — ver
 * `lib/motor/datas-do-campo.ts`.
 */
export function CelulaDeData({
  valor,
  fuso,
  tag,
  agora,
  aoSalvar,
  podeEditar,
  atrasada,
  rotulo,
}: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState("");

  function abrirOuFechar(abrir: boolean) {
    if (abrir) {
      setRascunho(paraCampoLocal(valor, fuso));
    } else {
      const novo = rascunho ? deCampoLocal(rascunho, fuso) : null;
      // Só grava o que mudou: abrir e fechar sem tocar em nada não pode virar uma edição.
      if (novo !== valor && !(novo === null && rascunho !== "")) aoSalvar(novo);
    }
    setAberto(abrir);
  }

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
            atrasada && "font-medium text-error-fg",
          )}
        >
          {valor ? rotuloDaData(valor, fuso, tag, agora) : t("Vazio")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2 p-3">
        <input
          type="datetime-local"
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
