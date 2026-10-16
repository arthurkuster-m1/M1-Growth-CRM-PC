"use client";

import * as React from "react";

import { useHorariosLivres } from "@/hooks/agenda/useHorariosLivres";
import { useT } from "@/hooks/i18n/useT";
import { chaveDoDia, inicioDoDia, somarDias } from "@/lib/inicio/datas";
import { diasDaGradeDoMes, inicioDoMes, somarMeses } from "@/lib/motor/calendario";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * O seletor que SÓ oferece horário livre: o calendário do mês deixa clicáveis apenas os dias em
 * que o atendente tem vaga, e o dia escolhido lista os horários dele. Quem marca não tem como
 * escolher um horário com choque, fora da jornada ou em cima de outro compromisso.
 */
export function SeletorDeHorarioLivre({
  eventTypeId,
  ownerId,
  ignorarId,
  fuso,
  tag,
  hoje,
  valor,
  aoEscolher,
}: {
  eventTypeId: string;
  ownerId?: string | null;
  /** Remarcar: o compromisso que sai do horário atual. */
  ignorarId?: string;
  fuso: string;
  tag: string;
  /** Hoje na organização (`YYYY-MM-DD`). */
  hoje: string;
  /** O horário atual (ISO), se houver. */
  valor: string | null;
  aoEscolher: (iso: string) => void;
}) {
  const t = useT();
  const diaDoValor = valor ? chaveDoDia(new Date(valor), fuso) : "";
  const [mes, setMes] = React.useState(() => inicioDoMes(diaDoValor || hoje));
  const [dia, setDia] = React.useState(diaDoValor);

  const dias = diasDaGradeDoMes(mes, true);
  while (dias.length < 42) dias.push(somarDias(dias[dias.length - 1]!, 1));

  const consulta = useHorariosLivres({
    event_type_id: eventTypeId,
    owner_user_id: ownerId ?? undefined,
    ignorar_agendamento_id: ignorarId,
    de: inicioDoDia(dias[0]!, fuso).toISOString(),
    ate: inicioDoDia(somarDias(dias[41]!, 1), fuso).toISOString(),
  });

  const porDia = React.useMemo(() => {
    const m = new Map<string, Array<{ inicio: string }>>();
    for (const s of consulta.data?.slots ?? []) {
      const k = chaveDoDia(new Date(s.inicio), fuso);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [consulta.data, fuso]);

  const nomeDoMes = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${mes}T12:00:00Z`),
  );
  const nomeDoDia = (d: string) =>
    new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" })
      .format(new Date(`${d}T12:00:00Z`))
      .replace(".", "");
  const hora = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: fuso });
  const doDia = dia ? (porDia.get(dia) ?? []) : [];

  return (
    <div className="flex flex-col gap-3" data-testid="seletor-de-horario-livre">
      <div className="rounded-2xl bg-secondary/60 p-3">
        <div className="flex items-center px-1 pb-2">
          <p className="flex-1 text-base font-semibold capitalize">{nomeDoMes}</p>
          <button type="button" aria-label={t("Mês anterior")} onClick={() => setMes((m) => somarMeses(m, -1))} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-secondary">
            <CaretLeft size={16} aria-hidden />
          </button>
          <button type="button" aria-label={t("Próximo mês")} onClick={() => setMes((m) => somarMeses(m, 1))} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-secondary">
            <CaretRight size={16} aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
          {dias.slice(0, 7).map((d) => (
            <span key={d} className="py-1.5">{nomeDoDia(d)}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {dias.map((d) => {
            const doMesAtual = d.slice(0, 7) === mes.slice(0, 7);
            const livre = porDia.has(d);
            const escolhido = d === dia;
            return (
              <button
                key={d}
                type="button"
                disabled={!livre}
                aria-pressed={escolhido}
                onClick={() => setDia(d)}
                className={cn(
                  "mx-auto grid h-10 w-10 place-items-center rounded-lg text-sm transition-colors",
                  escolhido
                    ? "bg-primary font-semibold text-primary-foreground"
                    : livre
                      ? "font-medium hover:bg-primary/10"
                      : "cursor-not-allowed text-muted-foreground opacity-40",
                  d === hoje && !escolhido && "ring-1 ring-error",
                  !doMesAtual && !escolhido && "opacity-60",
                )}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          {consulta.isLoading
            ? t("Buscando horários livres…")
            : consulta.data && !consulta.data.publicou_horarios
              ? t("Este atendente ainda não publicou horários de atendimento.")
              : t("Só os dias com horário livre podem ser escolhidos.")}
        </p>
      </div>

      {dia ? (
        <div className="rounded-2xl bg-secondary/60 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("Horários livres do dia")}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {doDia.map((s) => (
              <button
                key={s.inicio}
                type="button"
                data-testid="horario-livre"
                onClick={() => aoEscolher(s.inicio)}
                className={cn(
                  "rounded-xl border px-2 py-1.5 text-sm tabular-nums transition-colors",
                  valor && new Date(valor).getTime() === new Date(s.inicio).getTime()
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/60",
                )}
              >
                {hora.format(new Date(s.inicio))}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
