"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { useT } from "@/hooks/i18n/useT";
import { somarDias } from "@/lib/inicio/datas";
import {
  diasDaGradeDoMes,
  formatarDiaBr,
  inicioDoMes,
  lerDiaBr,
  somarMeses,
} from "@/lib/motor/calendario";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  /** `YYYY-MM-DD`, ou vazio. */
  dia: string;
  /** `HH:mm` quando a data leva horário; `null` = só a data. */
  hora: string | null;
  /** O dia de hoje na organização (`YYYY-MM-DD`). */
  hoje: string;
  tag: string;
  aoMudarDia: (dia: string) => void;
  aoMudarHora: (hora: string | null) => void;
  aoLimpar: () => void;
  /** Enter num campo: confirma e fecha. */
  aoConfirmar: () => void;
}

/**
 * O SELETOR DE DATA, no jeito do Notion: o campo da data por cima, o mês logo abaixo (hoje
 * num círculo vermelho, o dia escolhido num quadrado azul) e as opções ("Incluir hora",
 * "Limpar") num bloco separado. Semana de domingo a sábado, sempre seis linhas — o mês
 * não "pula" de altura ao virar.
 *
 * Só desenha e avisa: quem guarda o dia, a hora e o fuso é a célula (`CelulaDeData`).
 */
export function SeletorDeData({
  dia,
  hora,
  hoje,
  tag,
  aoMudarDia,
  aoMudarHora,
  aoLimpar,
  aoConfirmar,
}: Props) {
  const t = useT();
  const [mes, setMes] = useState(() => inicioDoMes(dia || hoje));
  const [texto, setTexto] = useState(() => formatarDiaBr(dia));
  const [textoDe, setTextoDe] = useState(dia);

  // O dia mudou por fora (clique no mês, "Limpar"): o campo de texto acompanha.
  if (dia !== textoDe) {
    setTextoDe(dia);
    setTexto(formatarDiaBr(dia));
  }

  const dias = diasDaGradeDoMes(mes, true);
  while (dias.length < 42) dias.push(somarDias(dias[dias.length - 1]!, 1));

  const nomeDoMes = new Intl.DateTimeFormat(tag, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${mes}T12:00:00Z`));
  const diaDaSemana = (chave: string) =>
    new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" })
      .format(new Date(`${chave}T12:00:00Z`))
      .replace(".", "");

  function aoDigitar(valor: string) {
    setTexto(valor);
    const lido = lerDiaBr(valor);
    if (lido) {
      setTextoDe(lido);
      aoMudarDia(lido);
      setMes(inicioDoMes(lido));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-secondary/60 p-3">
        <input
          inputMode="numeric"
          aria-label={t("Data")}
          placeholder="dd/mm/aaaa"
          value={texto}
          onChange={(e) => aoDigitar(e.target.value)}
          onBlur={() => setTexto(formatarDiaBr(dia))}
          onKeyDown={(e) => {
            if (e.key === "Enter") aoConfirmar();
          }}
          className="h-11 w-full rounded-xl border bg-background px-3 text-base outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="rounded-2xl bg-secondary/60 p-3">
        <div className="flex items-center px-1 pb-2">
          <p className="flex-1 text-base font-semibold capitalize">{nomeDoMes}</p>
          <button
            type="button"
            aria-label={t("Mês anterior")}
            onClick={() => setMes((m) => somarMeses(m, -1))}
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-secondary"
          >
            <CaretLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("Próximo mês")}
            onClick={() => setMes((m) => somarMeses(m, 1))}
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-secondary"
          >
            <CaretRight size={16} aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
          {dias.slice(0, 7).map((d) => (
            <span key={d} className="py-1.5">
              {diaDaSemana(d)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {dias.map((d) => {
            const doMes = d.slice(0, 7) === mes.slice(0, 7);
            const escolhido = d === dia;
            const ehHoje = d === hoje;
            return (
              <button
                key={d}
                type="button"
                aria-label={formatarDiaBr(d)}
                aria-pressed={escolhido}
                onClick={() => aoMudarDia(d)}
                onDoubleClick={aoConfirmar}
                className={cn(
                  "mx-auto grid h-10 w-10 place-items-center text-sm transition-colors",
                  escolhido
                    ? "rounded-lg bg-primary font-semibold text-primary-foreground"
                    : ehHoje
                      ? "rounded-full bg-error text-white"
                      : "rounded-lg hover:bg-secondary",
                  !doMes && !escolhido && !ehHoje && "text-muted-foreground opacity-70",
                )}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
      </div>

      <div className="divide-y rounded-2xl bg-secondary/60">
        <div className="flex min-h-12 items-center justify-between gap-3 px-4">
          <span className="text-sm">{t("Incluir hora")}</span>
          <div className="flex items-center gap-2">
            {hora !== null ? (
              <input
                type="time"
                aria-label={t("Horário")}
                value={hora}
                onChange={(e) => aoMudarHora(e.target.value || "09:00")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") aoConfirmar();
                }}
                className="h-9 rounded-lg border bg-background px-2 text-sm"
              />
            ) : null}
            <Switch
              checked={hora !== null}
              disabled={!dia}
              aria-label={t("Incluir hora")}
              onCheckedChange={(ligado) => aoMudarHora(ligado ? "09:00" : null)}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={aoLimpar}
          className="flex min-h-12 w-full items-center px-4 text-left text-sm text-error-fg hover:bg-secondary"
        >
          {t("Limpar")}
        </button>
      </div>
    </div>
  );
}
