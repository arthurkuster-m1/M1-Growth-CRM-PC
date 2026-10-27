"use client";

import { useMemo, useState } from "react";

import { SeletorDePeriodo, type AtalhoDePeriodo } from "@/components/motor/CalendarioDePeriodo";
import { hojeLocal } from "@/components/motor/atalhos-de-periodo";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { useTarefasAdiadas, type EventoDoHistorico } from "@/hooks/marketing/useCronograma";
import { somarDias } from "@/lib/inicio/datas";

const FUSO = "America/Sao_Paulo";
const diaBr = (iso: string | null, tag: string) =>
  iso
    ? new Date(iso).toLocaleDateString(tag, {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        timeZone: FUSO,
      })
    : "—";

interface TarefaAdiada {
  id: string;
  titulo: string;
  lado: string | null;
  prazoOriginal: string | null;
  eventos: EventoDoHistorico[];
}

/**
 * AS TAREFAS ADIADAS: cada tarefa que teve o prazo empurrado, quantas vezes e por quê, em qualquer
 * período (este mês, 6 meses, tudo). Só a agência vê: o cliente final não tem acesso.
 */
export function TarefasAdiadas({ empresa }: { empresa: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const hoje = hojeLocal();
  const [janela, setJanela] = useState(() => ({ de: `${hoje.slice(0, 7)}-01`, ate: hoje }));
  const consulta = useTarefasAdiadas(janela.de, janela.ate, true);

  const atalhos: AtalhoDePeriodo[] = [
    { id: "mes", rotulo: t("Este mês"), de: `${hoje.slice(0, 7)}-01`, ate: hoje },
    { id: "30", rotulo: t("Últimos 30 dias"), de: somarDias(hoje, -29), ate: hoje },
    { id: "90", rotulo: t("Últimos 3 meses"), de: somarDias(hoje, -89), ate: hoje },
    { id: "180", rotulo: t("Últimos 6 meses"), de: somarDias(hoje, -179), ate: hoje },
    { id: "ano", rotulo: t("Este ano"), de: `${hoje.slice(0, 4)}-01-01`, ate: hoje },
    { id: "tudo", rotulo: t("Todos os períodos"), de: "2020-01-01", ate: hoje },
  ];

  const tarefas = useMemo<TarefaAdiada[]>(() => {
    const porTarefa = new Map<string, TarefaAdiada>();
    for (const e of consulta.data ?? []) {
      const atual = porTarefa.get(e.task_id) ?? {
        id: e.task_id,
        titulo: e.crm_tasks?.title ?? "—",
        lado: e.crm_tasks?.cronograma_lado ?? null,
        prazoOriginal: e.crm_tasks?.prazo_original ?? null,
        eventos: [],
      };
      atual.eventos.push(e);
      porTarefa.set(e.task_id, atual);
    }
    return [...porTarefa.values()]
      .map((x) => ({
        ...x,
        eventos: [...x.eventos].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      }))
      .sort((a, b) => b.eventos.length - a.eventos.length);
  }, [consulta.data]);

  const visiveis = tarefas;
  const totalAdiamentos = tarefas.reduce((s, x) => s + x.eventos.length, 0);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <SeletorDePeriodo
          de={janela.de}
          ate={janela.ate}
          rotulo={t("Período dos adiamentos")}
          atalhos={atalhos}
          aoMudar={setJanela}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-l-4 border-l-orange-500 bg-card p-4">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Tarefas adiadas")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{tarefas.length}</p>
        </div>
        <div className="rounded-2xl border border-l-4 border-l-red-500 bg-card p-4">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Adiamentos no período")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalAdiamentos}</p>
        </div>
      </div>

      {consulta.isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
      ) : visiveis.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("Nenhuma tarefa adiada neste período.")}
        </p>
      ) : (
        <ul className="grid gap-3">
          {visiveis.map((x) => (
            <li
              key={x.id}
              className="min-w-0 rounded-2xl border border-l-4 border-l-orange-500 bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{x.titulo}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-orange-500/60 bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-300">
                    {t("adiada")} {x.eventos.length}x
                  </span>
                  {x.lado ? (
                    <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {x.lado === "agencia" ? t("Agência") : empresa || t("Cliente")}
                    </span>
                  ) : null}
                </div>
              </div>
              {x.prazoOriginal ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Prazo original")}: {diaBr(x.prazoOriginal, tag)}
                </p>
              ) : null}
              <ol className="mt-3 grid gap-2">
                {x.eventos.map((e, i) => (
                  <li key={e.id} className="rounded-xl bg-secondary/40 px-3 py-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">
                        {i + 1}º {t("adiamento")}: {diaBr(e.de_prazo, tag)} →{" "}
                        {diaBr(e.para_prazo, tag)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("em")} {diaBr(e.created_at, tag)}
                      </span>
                    </div>
                    {e.motivo ? (
                      <p className="mt-1 text-sm [overflow-wrap:anywhere]">
                        <span className="text-xs text-muted-foreground">{t("Por quê")}: </span>
                        {e.motivo}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-warning-fg">{t("Sem motivo registrado.")}</p>
                    )}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
