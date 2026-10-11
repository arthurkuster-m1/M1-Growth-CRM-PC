"use client";

import { useMemo, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { chaveDoDia, somarDias } from "@/lib/inicio/datas";
import { FUSO_DO_CRONOGRAMA } from "@/lib/marketing/cronograma";
import { CalendarBlank, CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const DIA_EM_MS = 86_400_000;

/** Um dia `YYYY-MM-DD` como instante UTC ao meio-dia (sem virar de dia por fuso). */
const instante = (chave: string) => new Date(`${chave}T12:00:00Z`);
const chave = (ano: number, mes: number, dia: number) =>
  new Date(Date.UTC(ano, mes, dia, 12)).toISOString().slice(0, 10);

/**
 * O SELETOR DE DATA: um botão com a data e, ao clicar, um calendário do mês (domingo na
 * primeira coluna, hoje destacado, atalho "Hoje" e "Limpar"). O valor é `YYYY-MM-DD` ou "".
 * Os nomes de mês e dia vêm do idioma da empresa (`Intl`), então sai em português.
 */
export function SeletorDeData({
  valor,
  aoMudar,
  rotulo,
  placeholder,
  className,
  limpavel = true,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  /** Nome acessível do botão. */
  rotulo: string;
  placeholder?: string;
  className?: string;
  limpavel?: boolean;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const [aberto, setAberto] = useState(false);
  const hoje = chaveDoDia(new Date(), FUSO_DO_CRONOGRAMA);
  const base = valor || hoje;
  const [mes, setMes] = useState(() => ({
    ano: Number(base.slice(0, 4)),
    m: Number(base.slice(5, 7)) - 1,
  }));

  const nomeDoMes = useMemo(
    () =>
      new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(
        instante(chave(mes.ano, mes.m, 1)),
      ),
    [tag, mes],
  );
  const diasDaSemana = useMemo(() => {
    const f = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" });
    // 2026-01-04 é um domingo.
    return Array.from({ length: 7 }, (_, i) => f.format(instante(somarDias("2026-01-04", i))));
  }, [tag]);
  const porExtenso = useMemo(
    () => new Intl.DateTimeFormat(tag, { dateStyle: "full", timeZone: "UTC" }),
    [tag],
  );
  const celulas = useMemo(() => {
    const primeiro = instante(chave(mes.ano, mes.m, 1));
    const recuo = primeiro.getUTCDay();
    const inicio = new Date(primeiro.getTime() - recuo * DIA_EM_MS).toISOString().slice(0, 10);
    return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i));
  }, [mes]);

  const texto = valor
    ? new Intl.DateTimeFormat(tag, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(instante(valor))
    : (placeholder ?? t("Escolher data"));

  const irParaMes = (delta: number) =>
    setMes(({ ano, m }) => {
      const d = new Date(Date.UTC(ano, m + delta, 1));
      return { ano: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  const escolher = (c: string) => {
    aoMudar(c);
    setAberto(false);
  };

  return (
    <Popover
      open={aberto}
      onOpenChange={(a) => {
        setAberto(a);
        if (a) setMes({ ano: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          className={cn(
            "inline-flex h-10 w-full items-center gap-2 rounded-xl border bg-background px-3 text-left text-sm outline-hidden",
            "hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary/30",
            !valor && "text-muted-foreground",
            className,
          )}
        >
          <CalendarBlank size={16} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="truncate">{texto}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[17.5rem] rounded-2xl p-3">
        <div className="mb-2 rounded-lg border bg-background px-3 py-2 text-sm">{texto}</div>
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-sm font-semibold capitalize">{nomeDoMes}</span>
          <span className="inline-flex items-center gap-0.5">
            <button
              type="button"
              aria-label={t("Mês anterior")}
              onClick={() => irParaMes(-1)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <CaretLeft size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                setMes({ ano: Number(hoje.slice(0, 4)), m: Number(hoje.slice(5, 7)) - 1 });
              }}
              className="h-7 rounded-md px-2 text-xs font-medium text-primary hover:bg-secondary"
            >
              {t("Hoje")}
            </button>
            <button
              type="button"
              aria-label={t("Próximo mês")}
              onClick={() => irParaMes(1)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <CaretRight size={14} aria-hidden />
            </button>
          </span>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
          {diasDaSemana.map((d) => (
            <span key={d} className="py-1 capitalize">
              {d.replace(".", "").slice(0, 3)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {celulas.map((c) => {
            const doMes = Number(c.slice(5, 7)) - 1 === mes.m;
            const selecionado = c === valor;
            const ehHoje = c === hoje;
            return (
              <button
                key={c}
                type="button"
                aria-label={porExtenso.format(instante(c))}
                aria-pressed={selecionado}
                onClick={() => escolher(c)}
                className={cn(
                  "mx-auto grid h-8 w-8 place-items-center rounded-full text-sm transition-colors",
                  doMes ? "text-foreground" : "text-muted-foreground opacity-60",
                  !selecionado && "hover:bg-secondary",
                  ehHoje && !selecionado && "font-semibold text-primary ring-1 ring-primary/50",
                  selecionado && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {Number(c.slice(8, 10))}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs">
          <button
            type="button"
            onClick={() => escolher(hoje)}
            className="rounded-md px-2 py-1 font-medium text-primary hover:bg-secondary"
          >
            {t("Ir para hoje")}
          </button>
          {limpavel && valor ? (
            <button
              type="button"
              onClick={() => escolher("")}
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {t("Limpar")}
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
