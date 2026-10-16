"use client";

import { useState } from "react";

import { SeletorDeData } from "@/components/motor/SeletorDeData";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCelular } from "@/hooks/motor/useCelular";
import { useT } from "@/hooks/i18n/useT";
import { deCampoLocal, hojeNoFuso, paraCampoLocal, rotuloDaData } from "@/lib/motor/datas-do-campo";
import { CalendarBlank } from "@/lib/ui/icons";

import { SeletorDeHorarioLivre } from "./SeletorDeHorarioLivre";
import { cn } from "@/lib/utils";

/**
 * O campo de DATA E HORA do compromisso: o mesmo seletor de data do app (calendário do mês), mas
 * com o horário sempre presente (compromisso não existe sem hora). Serve para marcar e para
 * REAGENDAR: `aoEscolher` recebe o novo instante em ISO com fuso.
 */
export function CampoDeDataEHora({
  valor,
  fuso,
  tag,
  aoEscolher,
  desabilitado,
  rotulo,
  className,
  horariosLivres,
}: {
  /**
   * Com o tipo (e o atendente), o campo só oferece os HORÁRIOS LIVRES dele: dias sem vaga ficam
   * desligados e o horário se escolhe numa lista. Sem isto, é o seletor livre de data e hora.
   */
  horariosLivres?: { eventTypeId: string; ownerId?: string | null; ignorarId?: string };
  /** ISO com fuso, ou `null` enquanto nada foi escolhido. */
  valor: string | null;
  fuso: string;
  tag: string;
  aoEscolher: (iso: string) => void;
  desabilitado?: boolean;
  rotulo: string;
  className?: string;
}) {
  const t = useT();
  const celular = useCelular();
  const [aberto, setAberto] = useState(false);
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState<string | null>("09:00");
  const agora = new Date();

  function abrirOuFechar(abrir: boolean) {
    if (abrir) {
      const [d = "", h = ""] = paraCampoLocal(valor, fuso).split("T");
      setDia(d || hojeNoFuso(agora, fuso));
      setHora(h || "09:00");
    } else if (dia) {
      const novo = deCampoLocal(`${dia}T${hora || "09:00"}`, fuso);
      if (novo && novo !== valor) aoEscolher(novo);
    }
    setAberto(abrir);
  }

  const gatilho = (
    <button
      type="button"
      disabled={desabilitado}
      aria-label={rotulo}
      data-testid="campo-de-data-e-hora"
      onClick={celular ? () => abrirOuFechar(true) : undefined}
      className={cn(
        "flex min-h-9 w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left text-sm",
        !desabilitado && "hover:border-primary/50",
        !valor && "text-text-subtle",
        className,
      )}
    >
      <CalendarBlank size={16} aria-hidden />
      <span className="truncate">
        {valor ? rotuloDaData(valor, fuso, tag, agora) : t("Escolher data e horário")}
      </span>
    </button>
  );
  const seletor = horariosLivres ? (
    <SeletorDeHorarioLivre
      eventTypeId={horariosLivres.eventTypeId}
      ownerId={horariosLivres.ownerId}
      ignorarId={horariosLivres.ignorarId}
      fuso={fuso}
      tag={tag}
      hoje={hojeNoFuso(agora, fuso)}
      valor={valor}
      aoEscolher={(iso) => {
        setAberto(false);
        if (iso !== valor) aoEscolher(iso);
      }}
    />
  ) : (
    <SeletorDeData
      dia={dia}
      hora={hora}
      hoje={hojeNoFuso(agora, fuso)}
      tag={tag}
      aoMudarDia={setDia}
      // O horário não se tira: sem hora não há compromisso.
      aoMudarHora={(h) => setHora(h ?? hora ?? "09:00")}
      aoLimpar={() => setHora("09:00")}
      aoConfirmar={() => abrirOuFechar(false)}
    />
  );

  if (celular) {
    return (
      <>
        {gatilho}
        <Sheet open={aberto} onOpenChange={abrirOuFechar}>
          <SheetContent side="bottom" className="max-h-[92dvh] gap-3 overflow-y-auto rounded-t-3xl p-4 pb-8">
            <SheetTitle className="text-center text-base font-semibold">{t("Data e horário")}</SheetTitle>
            {seletor}
          </SheetContent>
        </Sheet>
      </>
    );
  }
  return (
    <Popover open={aberto} onOpenChange={abrirOuFechar}>
      <PopoverTrigger asChild>{gatilho}</PopoverTrigger>
      <PopoverContent align="start" className="w-[330px] rounded-2xl p-3">
        {seletor}
      </PopoverContent>
    </Popover>
  );
}
