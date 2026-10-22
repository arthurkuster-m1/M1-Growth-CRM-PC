"use client";

import { useEffect, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { Clock } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  /** `HH:mm` (24 h). */
  valor: string;
  aoMudar: (hora: string) => void;
  /** Enter ou "Pronto": o seletor fecha e quem o contém pode confirmar. */
  aoConfirmar?: () => void;
}

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTOS_DE_5 = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function Coluna({
  rotulo,
  itens,
  atual,
  aoEscolher,
}: {
  rotulo: string;
  itens: string[];
  atual: string;
  aoEscolher: (v: string) => void;
}) {
  const ativo = useRef<HTMLButtonElement | null>(null);
  // Ao abrir, a coluna já mostra o valor atual no meio da lista.
  useEffect(() => {
    ativo.current?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="flex flex-col">
      <p className="px-2 pb-1 text-center text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
        {rotulo}
      </p>
      <div
        role="listbox"
        aria-label={rotulo}
        className="flex max-h-52 w-16 flex-col gap-0.5 overflow-y-auto rounded-xl bg-secondary/60 p-1"
      >
        {itens.map((v) => {
          const escolhido = v === atual;
          return (
            <button
              key={v}
              ref={escolhido ? ativo : undefined}
              type="button"
              role="option"
              aria-selected={escolhido}
              onClick={() => aoEscolher(v)}
              className={cn(
                "h-9 shrink-0 rounded-lg text-sm tabular-nums transition-colors",
                escolhido
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "hover:bg-secondary",
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * O seletor de horário no estilo das datas: um botão com a hora e, ao clicar, duas colunas
 * roláveis (horas e minutos) em vez do campo nativo do navegador.
 */
export function SeletorDeHora({ valor, aoMudar, aoConfirmar }: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [hh = "09", mm = "00"] = valor.split(":");
  const minutos = MINUTOS_DE_5.includes(mm)
    ? MINUTOS_DE_5
    : [...MINUTOS_DE_5, mm].sort((a, b) => Number(a) - Number(b));

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("Horário")}
          className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm tabular-nums transition-colors hover:bg-secondary"
        >
          {hh}:{mm}
          <Clock size={14} className="text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <div className="flex gap-2">
          <Coluna
            rotulo={t("Hora")}
            itens={HORAS}
            atual={hh}
            aoEscolher={(v) => aoMudar(`${v}:${mm}`)}
          />
          <Coluna
            rotulo={t("Min")}
            itens={minutos}
            atual={mm}
            aoEscolher={(v) => aoMudar(`${hh}:${v}`)}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            aoConfirmar?.();
          }}
          className="mt-3 h-9 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          {t("Pronto")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
