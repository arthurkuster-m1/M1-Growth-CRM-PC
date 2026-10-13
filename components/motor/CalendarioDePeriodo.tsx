"use client";

import { useState, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { somarDias } from "@/lib/inicio/datas";
import {
  diasDaGradeDoMes,
  formatarDiaBr,
  inicioDoMes,
  lerDiaBr,
  somarMeses,
} from "@/lib/motor/calendario";
import { CalendarBlank, CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** O dia de hoje (`YYYY-MM-DD`) no relógio de quem está olhando. */
function hojeLocal(): string {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

interface EstadoDoDia {
  /** Início ou fim do que foi escolhido (quadrado cheio). */
  extremo?: boolean;
  /** Entre o início e o fim (faixa clara). */
  dentro?: boolean;
  desabilitado?: boolean;
}

/** O mês do Notion: semana de domingo a sábado, sempre seis linhas, hoje num círculo vermelho. */
function GradeDoMes({
  mes,
  aoMudarMes,
  hoje,
  estado,
  aoEscolher,
  aoPassarPor,
}: {
  mes: string;
  aoMudarMes: (mes: string) => void;
  hoje: string;
  estado: (dia: string) => EstadoDoDia;
  aoEscolher: (dia: string) => void;
  aoPassarPor?: (dia: string | null) => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const dias = diasDaGradeDoMes(mes, true);
  while (dias.length < 42) dias.push(somarDias(dias[dias.length - 1]!, 1));
  const nomeDoMes = new Intl.DateTimeFormat(tag, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${mes}T12:00:00Z`));
  const diaDaSemana = (chave: string) =>
    new Intl.DateTimeFormat(tag, { weekday: "narrow", timeZone: "UTC" }).format(
      new Date(`${chave}T12:00:00Z`),
    );

  return (
    <div className="w-full select-none" onMouseLeave={() => aoPassarPor?.(null)}>
      <div className="flex items-center px-1 pb-2">
        <p className="flex-1 text-sm font-semibold capitalize">{nomeDoMes}</p>
        <button
          type="button"
          aria-label={t("Mês anterior")}
          onClick={() => aoMudarMes(somarMeses(mes, -1))}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
        >
          <CaretLeft size={14} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t("Próximo mês")}
          onClick={() => aoMudarMes(somarMeses(mes, 1))}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
        >
          <CaretRight size={14} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground uppercase">
        {dias.slice(0, 7).map((d) => (
          <span key={d} className="py-1">
            {diaDaSemana(d)}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {dias.map((d) => {
          const doMes = d.slice(0, 7) === mes.slice(0, 7);
          const e = estado(d);
          const ehHoje = d === hoje;
          return (
            <div key={d} className={cn("flex justify-center", e.dentro && "bg-primary/12")}>
              <button
                type="button"
                disabled={e.desabilitado}
                aria-label={formatarDiaBr(d)}
                aria-pressed={e.extremo}
                onClick={() => aoEscolher(d)}
                onMouseEnter={() => aoPassarPor?.(d)}
                className={cn(
                  "grid h-9 w-9 place-items-center text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                  e.extremo
                    ? "rounded-lg bg-primary font-semibold text-primary-foreground"
                    : ehHoje
                      ? "rounded-full bg-error font-semibold text-white"
                      : "rounded-lg hover:bg-secondary",
                  !doMes && !e.extremo && !ehHoje && "text-muted-foreground opacity-60",
                )}
              >
                {Number(d.slice(8))}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** O mês solto, para dentro de outro painel (célula de dia das tabelas). */
export function CalendarioDoDia({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (dia: string) => void;
}) {
  const hoje = hojeLocal();
  const [mes, setMes] = useState(() => inicioDoMes(valor || hoje));
  return (
    <GradeDoMes
      mes={mes}
      aoMudarMes={setMes}
      hoje={hoje}
      estado={(d) => ({ extremo: d === valor })}
      aoEscolher={aoMudar}
    />
  );
}

/** O botão que mostra a escolha e abre o calendário (mesmo visual dos campos do produto). */
function Gatilho({
  children,
  vazio,
  className,
  desabilitado,
  rotulo,
}: {
  children: ReactNode;
  vazio: boolean;
  className?: string;
  desabilitado?: boolean;
  rotulo: string;
}) {
  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        disabled={desabilitado}
        aria-label={rotulo}
        className={cn(
          "inline-flex h-10 min-w-0 items-center gap-2 rounded-xl border bg-background px-3 text-sm whitespace-nowrap outline-hidden hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60",
          vazio && "text-muted-foreground",
          className,
        )}
      >
        <CalendarBlank size={16} className="shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{children}</span>
      </button>
    </PopoverTrigger>
  );
}

/**
 * UMA DATA, no jeito do Notion: o campo mostra o dia; ao clicar abre o mês, com o campo de
 * digitação por cima e "Hoje" e "Limpar" embaixo. Substitui `<input type="date">`.
 */
export function CampoDeData({
  valor,
  aoMudar,
  rotulo,
  placeholder,
  min,
  max,
  limpavel = true,
  desabilitado,
  className,
}: {
  /** `YYYY-MM-DD`, ou vazio. */
  valor: string;
  aoMudar: (dia: string) => void;
  rotulo: string;
  placeholder?: string;
  min?: string;
  max?: string;
  limpavel?: boolean;
  desabilitado?: boolean;
  className?: string;
}) {
  const t = useT();
  const hoje = hojeLocal();
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(() => inicioDoMes(valor || hoje));
  const [texto, setTexto] = useState(formatarDiaBr(valor));
  const [textoDe, setTextoDe] = useState(valor);
  if (valor !== textoDe) {
    setTextoDe(valor);
    setTexto(formatarDiaBr(valor));
  }
  const fora = (d: string) => (min !== undefined && d < min) || (max !== undefined && d > max);

  return (
    <Popover
      open={aberto}
      onOpenChange={(a) => {
        setAberto(a);
        if (a) setMes(inicioDoMes(valor || hoje));
      }}
    >
      <Gatilho
        vazio={valor === ""}
        className={className}
        desabilitado={desabilitado}
        rotulo={rotulo}
      >
        {valor ? formatarDiaBr(valor) : (placeholder ?? t("Escolher data"))}
      </Gatilho>
      <PopoverContent align="start" className="w-[300px] p-3">
        <input
          inputMode="numeric"
          aria-label={rotulo}
          placeholder="dd/mm/aaaa"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            const lido = lerDiaBr(e.target.value);
            if (lido && !fora(lido)) {
              setTextoDe(lido);
              aoMudar(lido);
              setMes(inicioDoMes(lido));
            }
          }}
          onKeyDown={(e) => e.key === "Enter" && setAberto(false)}
          className="mb-3 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
        <GradeDoMes
          mes={mes}
          aoMudarMes={setMes}
          hoje={hoje}
          estado={(d) => ({ extremo: d === valor, desabilitado: fora(d) })}
          aoEscolher={(d) => {
            aoMudar(d);
            setAberto(false);
          }}
        />
        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <button
            type="button"
            disabled={fora(hoje)}
            onClick={() => {
              aoMudar(hoje);
              setAberto(false);
            }}
            className="rounded-lg px-2 py-1.5 text-sm font-medium text-primary hover:bg-secondary disabled:opacity-40"
          >
            {t("Hoje")}
          </button>
          {limpavel && valor !== "" ? (
            <button
              type="button"
              onClick={() => {
                aoMudar("");
                setAberto(false);
              }}
              className="rounded-lg px-2 py-1.5 text-sm text-error-fg hover:bg-secondary"
            >
              {t("Limpar")}
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface AtalhoDePeriodo {
  id: string;
  rotulo: string;
  de: string;
  ate: string;
}

/**
 * UM PERÍODO (início e fim), no jeito do Notion: o botão mostra "01/10/2026 → 31/10/2026"; o
 * painel tem os atalhos (este mês, últimos 30 dias…) ao lado e o mês para clicar o início e o
 * fim. Dois cliques escolhem o intervalo; o segundo fecha.
 */
export function SeletorDePeriodo({
  de,
  ate,
  aoMudar,
  rotulo,
  atalhos = [],
  className,
  aoVoltarAoPadrao,
  rotuloVoltar,
  max,
}: {
  /** Quando passado, o painel ganha o botão de voltar ao período padrão da tela. */
  aoVoltarAoPadrao?: () => void;
  /** O texto desse botão (padrão: "Voltar ao período da campanha"). */
  rotuloVoltar?: string;
  /** Último dia que se pode escolher (ex.: ontem, nas telas que não leem o dia em andamento). */
  max?: string;
  de: string;
  ate: string;
  aoMudar: (p: { de: string; ate: string }) => void;
  rotulo: string;
  atalhos?: AtalhoDePeriodo[];
  className?: string;
}) {
  const t = useT();
  const hoje = hojeLocal();
  const [aberto, setAberto] = useState(false);
  // Meio da escolha: o início já foi clicado e falta o fim.
  const [inicio, setInicio] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [mes, setMes] = useState(() => inicioDoMes(de || hoje));

  const extremoA = inicio ?? de;
  const extremoB = inicio ? (sobre ?? inicio) : ate;
  const [a, b] = extremoA <= extremoB ? [extremoA, extremoB] : [extremoB, extremoA];

  const escolher = (d: string) => {
    if (inicio === null) {
      setInicio(d);
      setSobre(d);
      return;
    }
    const [x, y] = inicio <= d ? [inicio, d] : [d, inicio];
    aoMudar({ de: x, ate: y });
    setInicio(null);
    setSobre(null);
    setAberto(false);
  };

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        setInicio(null);
        setSobre(null);
        if (v) setMes(inicioDoMes(de || hoje));
      }}
    >
      <Gatilho vazio={!de || !ate} className={className} rotulo={rotulo}>
        {de && ate ? `${formatarDiaBr(de)} → ${formatarDiaBr(ate)}` : t("Escolher período")}
      </Gatilho>
      <PopoverContent align="start" className="w-[min(94vw,520px)] p-3">
        <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
          <div className="grid content-start gap-0.5">
            {atalhos.length === 0 ? null : (
              <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t("Atalhos")}
              </p>
            )}
            {atalhos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  aoMudar({ de: p.de, ate: p.ate });
                  setAberto(false);
                }}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary",
                  p.de === de && p.ate === ate && "bg-secondary font-medium",
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          <div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border bg-background px-3 py-1.5">
                <p className="text-[10px] text-muted-foreground uppercase">{t("Início")}</p>
                <p className="text-sm font-medium">{a ? formatarDiaBr(a) : "—"}</p>
              </div>
              <div className="rounded-xl border bg-background px-3 py-1.5">
                <p className="text-[10px] text-muted-foreground uppercase">{t("Fim")}</p>
                <p className="text-sm font-medium">
                  {inicio && sobre === inicio ? "…" : b ? formatarDiaBr(b) : "—"}
                </p>
              </div>
            </div>
            <GradeDoMes
              mes={mes}
              aoMudarMes={setMes}
              hoje={hoje}
              estado={(d) => ({
                extremo: d === a || d === b,
                dentro: a !== "" && b !== "" && d > a && d < b,
                desabilitado: max !== undefined && d > max,
              })}
              aoEscolher={escolher}
              aoPassarPor={(d) => inicio !== null && setSobre(d ?? inicio)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {inicio === null
                ? t("Clique no primeiro dia e depois no último.")
                : t("Agora clique no último dia do período.")}
            </p>
            {aoVoltarAoPadrao ? (
              <button
                type="button"
                onClick={() => {
                  aoVoltarAoPadrao();
                  setAberto(false);
                }}
                className="mt-3 h-9 w-full rounded-lg border text-sm font-medium hover:bg-secondary"
              >
                {rotuloVoltar ?? t("Voltar ao período da campanha")}
              </button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
