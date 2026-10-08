"use client";

import { useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { chaveDoDia, somarDias } from "@/lib/inicio/datas";
import { diasSeguidos, diferencaEmDias } from "@/lib/motor/calendario";
import { estiloDaEtiqueta } from "@/lib/motor/cores";
import { opcaoDaTarefa, type OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import type { Tarefa } from "@/lib/tarefas/tipos";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const DIAS_NA_JANELA = 28;
const LARGURA_DO_DIA = 32;

interface Props {
  tarefas: Tarefa[];
  opcoes: OpcaoDeStatus[];
  fuso: string;
  tag: string;
  hoje: string;
}

/**
 * A LINHA DO TEMPO — uma barra por tarefa, do dia em que foi criada até o prazo. Quatro
 * semanas por vez; as setas andam de semana em semana. Tarefas sem prazo não têm onde
 * terminar e ficam de fora (a contagem aparece embaixo).
 */
export function LinhaDoTempo({ tarefas, opcoes, fuso, tag, hoje }: Props) {
  const t = useT();
  const [inicio, setInicio] = useState(() => somarDias(hoje, -7));
  const dias = diasSeguidos(inicio, DIAS_NA_JANELA);
  const fim = dias[dias.length - 1]!;

  const comPrazo = tarefas.flatMap((tarefa) => {
    if (!tarefa.due_date) return [];
    const prazo = chaveDoDia(new Date(tarefa.due_date), fuso);
    const criada = chaveDoDia(new Date(tarefa.created_at), fuso);
    const de = criada <= prazo ? criada : prazo;
    // Fora da janela = não aparece.
    if (prazo < inicio || de > fim) return [];
    return [{ tarefa, de, ate: prazo }];
  });
  const semPrazo = tarefas.filter((x) => !x.due_date).length;

  const rotuloDoDia = (d: string) =>
    new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${d}T12:00:00Z`),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
          {rotuloDoDia(inicio)} – {rotuloDoDia(fim)}
        </h2>
        <button
          type="button"
          onClick={() => setInicio(somarDias(hoje, -7))}
          className="h-8 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {t("Hoje")}
        </button>
        <button
          type="button"
          aria-label={t("Semana anterior")}
          onClick={() => setInicio((i) => somarDias(i, -7))}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
        >
          <CaretLeft size={16} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t("Próxima semana")}
          onClick={() => setInicio((i) => somarDias(i, 7))}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
        >
          <CaretRight size={16} aria-hidden />
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <div style={{ minWidth: 120 + DIAS_NA_JANELA * LARGURA_DO_DIA }}>
          <div className="flex border-b bg-secondary/50 text-[11px] text-muted-foreground">
            <div className="sticky left-0 z-10 w-[120px] shrink-0 bg-secondary px-2 py-2 md:w-[200px]" />
            {dias.map((d) => (
              <div
                key={d}
                style={{ width: LARGURA_DO_DIA }}
                className={cn(
                  "shrink-0 py-2 text-center",
                  d === hoje && "font-semibold text-primary",
                )}
              >
                {Number(d.slice(8))}
              </div>
            ))}
          </div>
          {comPrazo.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("Nenhuma tarefa com prazo nestas semanas.")}
            </p>
          ) : (
            comPrazo.map(({ tarefa, de, ate }) => {
              const ini = Math.max(0, diferencaEmDias(inicio, de));
              const fimIdx = Math.min(DIAS_NA_JANELA - 1, diferencaEmDias(inicio, ate));
              const cor = opcaoDaTarefa(tarefa, opcoes)?.color ?? "gray";
              return (
                <div key={tarefa.id} className="flex border-b last:border-b-0">
                  <div
                    title={tarefa.title}
                    className="sticky left-0 z-10 w-[120px] shrink-0 truncate bg-card px-2 py-2 text-sm md:w-[200px]"
                  >
                    {tarefa.title}
                  </div>
                  <div className="relative h-9" style={{ width: DIAS_NA_JANELA * LARGURA_DO_DIA }}>
                    {dias.includes(hoje) ? (
                      <span
                        aria-hidden
                        style={{ left: diferencaEmDias(inicio, hoje) * LARGURA_DO_DIA + 15 }}
                        className="absolute inset-y-0 w-px bg-primary/40"
                      />
                    ) : null}
                    <span
                      style={{
                        ...estiloDaEtiqueta(cor),
                        left: ini * LARGURA_DO_DIA + 2,
                        width: Math.max(1, fimIdx - ini + 1) * LARGURA_DO_DIA - 4,
                      }}
                      className="absolute top-1.5 h-6 rounded-md"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {semPrazo > 0 ? (
        <p className="text-xs text-muted-foreground">
          {semPrazo} {t("sem prazo, fora da linha do tempo.")}
        </p>
      ) : null}
    </div>
  );
}
