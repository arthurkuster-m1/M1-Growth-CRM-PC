"use client";

import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { estiloDoPonto, ROTULO_DA_COR } from "@/lib/motor/cores";
import { CORES_DA_OPCAO, type CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { Check } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** A bolinha de cor que abre a paleta — o seletor de cor das opções. */
export function SeletorDeCor({
  valor,
  aoEscolher,
}: {
  valor: CorDaOpcao;
  aoEscolher: (cor: CorDaOpcao) => void;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${t("Cor")}: ${t(ROTULO_DA_COR[valor])}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border bg-background hover:bg-secondary"
        >
          <span className="h-3.5 w-3.5 rounded-full" style={estiloDoPonto(valor)} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-3 gap-1.5">
          {CORES_DA_OPCAO.map((cor) => (
            <button
              key={cor}
              type="button"
              title={t(ROTULO_DA_COR[cor])}
              aria-label={t(ROTULO_DA_COR[cor])}
              aria-pressed={cor === valor}
              onClick={() => {
                aoEscolher(cor);
                setAberto(false);
              }}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md border transition-colors hover:bg-secondary",
                cor === valor && "ring-2 ring-primary/50",
              )}
            >
              <span
                className="grid h-4 w-4 place-items-center rounded-full text-white"
                style={estiloDoPonto(cor)}
              >
                {cor === valor ? <Check size={10} weight="bold" aria-hidden /> : null}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
