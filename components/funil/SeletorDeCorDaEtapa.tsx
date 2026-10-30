"use client";

import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { corDaEtapa, hexDaCor, type EtapaComCor } from "@/lib/funil/cores-da-etapa";
import { BASE_DA_COR, ROTULO_DA_COR } from "@/lib/motor/cores";
import { CORES_DA_OPCAO } from "@/lib/tarefas/opcoes-de-status";
import { Check } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * A bolinha que escolhe a cor da etapa do funil. A cor escolhida é a que a etapa mostra em toda
 * tag e seletor do sistema (`lib/funil/cores-da-etapa.ts`). `aoEscolher` recebe o hex da paleta.
 */
export function SeletorDeCorDaEtapa({
  etapa,
  aoEscolher,
  desabilitado,
  rotulo,
}: {
  etapa: EtapaComCor;
  aoEscolher: (hex: string) => void;
  desabilitado?: boolean;
  rotulo?: string;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const atual = corDaEtapa(etapa);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={desabilitado}
          aria-label={rotulo ?? t("Cor da etapa")}
          title={`${t("Cor da etapa")}: ${t(ROTULO_DA_COR[atual])}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-card hover:bg-secondary disabled:opacity-50"
        >
          <span
            aria-hidden
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: BASE_DA_COR[atual] }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {CORES_DA_OPCAO.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={t(ROTULO_DA_COR[c])}
              title={t(ROTULO_DA_COR[c])}
              onClick={() => {
                aoEscolher(hexDaCor(c));
                setAberto(false);
              }}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full border-2 border-transparent hover:scale-105",
                c === atual && "border-foreground/60",
              )}
              style={{ backgroundColor: BASE_DA_COR[c] }}
            >
              {c === atual ? <Check size={14} className="text-white" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
