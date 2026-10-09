"use client";

import { useState } from "react";

import { SeletorDeData } from "@/components/motor/SeletorDeData";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCelular } from "@/hooks/motor/useCelular";
import { useT } from "@/hooks/i18n/useT";
import { deCampoLocal, hojeNoFuso, paraCampoLocal, rotuloDaData } from "@/lib/motor/datas-do-campo";
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
  const celular = useCelular();
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

  const gatilho = (
    <button
      type="button"
      disabled={!podeEditar}
      aria-label={rotulo}
      onClick={celular ? () => abrirOuFechar(true) : undefined}
      className={cn(
        "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm",
        podeEditar && "hover:bg-secondary",
        !valor && "text-text-subtle",
        atrasada && "font-medium text-error-fg",
      )}
    >
      {valor ? rotuloDaData(valor, fuso, tag, agora) : t("Vazio")}
    </button>
  );
  const seletor = (
    <SeletorDeData
      dia={dia}
      hora={hora}
      hoje={hojeNoFuso(agora, fuso)}
      tag={tag}
      aoMudarDia={setDia}
      aoMudarHora={setHora}
      aoLimpar={() => {
        setDia("");
        setHora(null);
      }}
      aoConfirmar={() => abrirOuFechar(false)}
    />
  );

  // No celular o seletor sobe de baixo, como uma gaveta (igual ao Notion); no computador,
  // abre ao lado da célula.
  if (celular) {
    return (
      <>
        {gatilho}
        <Sheet open={aberto} onOpenChange={abrirOuFechar}>
          <SheetContent
            side="bottom"
            className="max-h-[92dvh] gap-3 overflow-y-auto rounded-t-3xl p-4 pb-8"
          >
            <SheetTitle className="text-center text-base font-semibold">{t("Data")}</SheetTitle>
            {seletor}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={aberto} onOpenChange={abrirOuFechar}>
      <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
      <PopoverContent align="start" className="w-[330px] p-3">
        {seletor}
      </PopoverContent>
    </Popover>
  );
}
