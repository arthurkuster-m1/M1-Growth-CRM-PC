"use client";

import Link from "next/link";
import { useState } from "react";

import { textoDoEstado } from "@/components/marketing/campanhas/rotulos";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { chaveDoDia, somarDias } from "@/lib/inicio/datas";
import type { CampanhaDeDemanda } from "@/lib/marketing/campanhas";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const SEMANAS = 13;
const DIAS = SEMANAS * 7;
const CLASSE_DO_STATUS: Record<CampanhaDeDemanda["status"], string> = {
  planejada: "bg-secondary border-border-strong text-foreground",
  ativa: "bg-primary text-primary-foreground border-primary",
  pausada: "bg-warning-bg text-warning-fg border-warning",
  encerrada: "bg-muted text-muted-foreground border-border",
};

/**
 * A LINHA DO TEMPO das campanhas: uma barra por campanha, do início ao fim (a contínua vai até
 * a borda, com uma seta). Treze semanas por vez; as setas andam um mês.
 */
export function LinhaDoTempoDeCampanhas({
  campanhas,
  base,
  fuso,
}: {
  campanhas: readonly CampanhaDeDemanda[];
  base: string;
  fuso: string;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const hoje = chaveDoDia(new Date(), fuso);
  const [inicio, setInicio] = useState(() => somarDias(hoje, -21));
  const fim = somarDias(inicio, DIAS - 1);
  const coluna = (dia: string) => {
    const n = Math.round(
      (Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86_400_000,
    );
    return Math.min(DIAS, Math.max(0, n)) + 1;
  };

  const comData = campanhas.flatMap((c) => {
    if (!c.start_date && !c.end_date) return [];
    const de = c.start_date ?? c.end_date!;
    const ate = c.continuous || !c.end_date ? null : c.end_date;
    if (ate !== null && ate < inicio) return [];
    if (de > fim) return [];
    return [{ c, de, ate }];
  });
  const semData = campanhas.filter((c) => !c.start_date && !c.end_date);
  const formato = new Intl.DateTimeFormat(tag, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  const semanas = Array.from({ length: SEMANAS }, (_, i) => somarDias(inicio, i * 7));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label={t("Semanas anteriores")}
          onClick={() => setInicio(somarDias(inicio, -28))}
          className="grid h-9 w-9 place-items-center rounded-lg border hover:bg-secondary"
        >
          <CaretLeft size={14} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t("Próximas semanas")}
          onClick={() => setInicio(somarDias(inicio, 28))}
          className="grid h-9 w-9 place-items-center rounded-lg border hover:bg-secondary"
        >
          <CaretRight size={14} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setInicio(somarDias(hoje, -21))}
          className="h-9 rounded-lg px-3 text-sm font-medium text-primary hover:bg-secondary"
        >
          {t("Hoje")}
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <div className="min-w-[860px]">
          <div
            className="grid border-b text-xs text-muted-foreground"
            style={{ gridTemplateColumns: `300px repeat(${DIAS}, minmax(0, 1fr))` }}
          >
            <div className="px-3 py-2">{t("Campanha")}</div>
            {semanas.map((s, i) => (
              <div
                key={s}
                className="border-l px-1 py-2"
                style={{ gridColumn: `${2 + i * 7} / span 7` }}
              >
                {formato.format(new Date(`${s}T12:00:00Z`))}
              </div>
            ))}
          </div>
          {comData.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("Nenhuma campanha com datas neste período.")}
            </p>
          ) : (
            comData.map(({ c, de, ate }) => (
              <div
                key={c.id}
                className="relative grid items-center border-b last:border-b-0"
                style={{ gridTemplateColumns: `300px repeat(${DIAS}, minmax(0, 1fr))` }}
              >
                <div className="min-w-0 px-3 py-2">
                  <Link
                    href={`${base}/${c.id}`}
                    className="block truncate text-sm font-medium hover:text-primary hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p
                    className="truncate text-[11px] text-muted-foreground tabular-nums"
                    title={textoDoEstado(t, c.estado)}
                  >
                    {textoDoEstado(t, c.estado)}
                  </p>
                </div>
                {hoje >= inicio && hoje <= fim ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 w-px bg-primary/50"
                    style={{ left: `calc(300px + (100% - 300px) * ${(coluna(hoje) - 1) / DIAS})` }}
                  />
                ) : null}
                <Link
                  href={`${base}/${c.id}`}
                  title={c.name}
                  className={cn(
                    "my-2 flex h-7 items-center overflow-hidden rounded-lg border px-2 text-[11px] font-medium whitespace-nowrap",
                    CLASSE_DO_STATUS[c.status],
                  )}
                  style={{
                    gridColumn: `${1 + coluna(de < inicio ? inicio : de)} / ${
                      ate === null ? DIAS + 2 : coluna(ate > fim ? fim : ate) + 2
                    }`,
                  }}
                >
                  {ate === null ? `${c.name} →` : c.name}
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
      {semData.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("Sem datas definidas")}: {semData.map((c) => c.name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
