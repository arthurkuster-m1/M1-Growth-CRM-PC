"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { somarDias } from "@/lib/inicio/datas";
import type {
  ItemDaSemana,
  ResumoDaSemana,
  SituacaoNaSemana,
} from "@/lib/marketing/historico-das-semanas";
import { CaretDown } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const FUSO = "America/Sao_Paulo";
const diaBr = (chave: string) => {
  const [a, m, d] = chave.split("-");
  return `${d}/${m}/${a?.slice(2)}`;
};
const diaDaData = (iso: string | null, tag: string) =>
  iso
    ? new Date(iso).toLocaleDateString(tag, { day: "2-digit", month: "2-digit", timeZone: FUSO })
    : "—";

/**
 * O histórico POR SEMANA: cada semana é um toggle com o resumo na cara (feitas, não feitas e a nota
 * da autoavaliação); aberto, mostra as tarefas e tudo o que foi adicionado, adiado ou excluído.
 */
export function HistoricoPorSemana() {
  const t = useT();
  const tag = useTagDeIdioma();
  const consulta = useQuery({
    queryKey: ["cronograma-historico-semanas"],
    queryFn: async () =>
      (
        await apiClient.get<{ data: { semanas: ResumoDaSemana[] } }>(
          "/api/v1/marketing/cronograma/historico-semanas",
        )
      ).data.semanas,
    staleTime: 10_000,
  });
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  const semanas = consulta.data ?? [];

  if (consulta.isLoading) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{t("Carregando…")}</p>;
  }
  if (semanas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("Nada registrado ainda.")}
      </p>
    );
  }
  return (
    <ul className="grid gap-2" data-testid="historico-por-semana">
      {semanas.map((s) => {
        const aberta = abertas[s.semana_inicio] === true;
        return (
          <li key={s.semana_inicio} className="rounded-2xl border bg-card">
            <button
              type="button"
              aria-expanded={aberta}
              onClick={() => setAbertas((a) => ({ ...a, [s.semana_inicio]: !aberta }))}
              className="flex min-h-14 w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left"
            >
              <CaretDown
                size={14}
                aria-hidden
                className={cn("shrink-0 transition-transform", !aberta && "-rotate-90")}
              />
              <span className="text-sm font-semibold">
                {t("Semana")} {diaBr(s.semana_inicio)} → {diaBr(somarDias(s.semana_inicio, 6))}
              </span>
              <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-success-fg">
                  {s.feitas} {t("feitas")}
                </span>
                <span className={s.nao_feitas > 0 ? "text-error-fg" : "text-muted-foreground"}>
                  {s.nao_feitas} {t("não feitas")}
                </span>
                <span className="font-semibold tabular-nums">
                  {s.nota === null ? t("Sem autoavaliação") : `${s.nota}%`}
                </span>
              </span>
            </button>
            {aberta ? (
              <div className="grid gap-4 border-t px-4 py-3 text-sm md:grid-cols-2">
                <ListaDoLado titulo={t("Tarefas da agência")} itens={s.agencia} />
                <ListaDoLado titulo={t("Tarefas do cliente")} itens={s.cliente} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const ROTULO: Record<SituacaoNaSemana, string> = {
  feita: "Realizada",
  nao_feita: "Não realizada",
  adiada: "Adiada",
  cancelada: "Cancelada",
};
const COR: Record<SituacaoNaSemana, string> = {
  feita: "bg-success-bg text-success-fg",
  nao_feita: "bg-error-bg text-error-fg",
  adiada: "bg-warning-bg text-warning-fg",
  cancelada: "bg-secondary text-muted-foreground",
};

function ListaDoLado({ titulo, itens }: { titulo: string; itens: ItemDaSemana[] }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const detalhe = (i: ItemDaSemana): string | null => {
    if (!i.data) return null;
    const dia = diaDaData(i.data, tag);
    if (i.situacao === "feita") return `${t("em")} ${dia}`;
    if (i.situacao === "adiada") return `${t("para")} ${dia}`;
    return `${t("em")} ${dia}`;
  };
  return (
    <div className="grid content-start gap-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase">
        {titulo} ({itens.length})
      </h4>
      {itens.length === 0 ? (
        <p className="text-muted-foreground">{t("Nenhuma tarefa nesta semana.")}</p>
      ) : (
        <ul className="grid gap-1.5">
          {itens.map((i) => (
            <li key={i.chave} className="rounded-lg bg-secondary/40 px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">
                  {i.titulo}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                    COR[i.situacao],
                  )}
                >
                  {t(ROTULO[i.situacao])}
                  {detalhe(i) ? ` ${detalhe(i)}` : ""}
                </span>
              </div>
              {i.motivo ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("Por quê")}: {i.motivo}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
