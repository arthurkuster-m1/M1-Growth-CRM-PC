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
 * A data da célula. Clicou, abre o seletor de DATA; o horário é opcional ("Adicionar
 * horário"). Sem horário, a data vale o dia todo (guardada como meia-noite do fuso da
 * organização) e a célula mostra só o dia. Ao fechar (ou Enter) salva.
 * O relógio é o da ORGANIZAÇÃO (`fuso`), nunca o do navegador — ver
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
  const [dia, setDia] = useState("");
  /** `null` = só a data; `"HH:mm"` = com horário (o campo de hora aparece). */
  const [hora, setHora] = useState<string | null>(null);

  function abrirOuFechar(abrir: boolean) {
    if (abrir) {
      const [d = "", h = ""] = paraCampoLocal(valor, fuso).split("T");
      setDia(d);
      setHora(h && h !== "00:00" ? h : null);
    } else {
      const novo = dia ? deCampoLocal(`${dia}T${hora || "00:00"}`, fuso) : null;
      // Só grava o que mudou: abrir e fechar sem tocar em nada não pode virar uma edição.
      if (novo !== valor && !(novo === null && dia !== "")) aoSalvar(novo);
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
          type="date"
          aria-label={rotulo}
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") abrirOuFechar(false);
          }}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        {hora === null ? (
          <button
            type="button"
            disabled={!dia}
            onClick={() => setHora("09:00")}
            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            {t("Adicionar horário")}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="time"
              aria-label={t("Horário")}
              value={hora}
              onChange={(e) => setHora(e.target.value || null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") abrirOuFechar(false);
              }}
              className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => setHora(null)}
              className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {t("Tirar horário")}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setDia("");
            setHora(null);
          }}
          className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {t("Limpar")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
