"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { somarDias } from "@/lib/inicio/datas";
import type { ResumoDaSemana } from "@/lib/marketing/historico-das-semanas";
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

  const texto = (tipo: string, de: string | null, para: string | null): string => {
    switch (tipo) {
      case "prazo_alterado":
        return `${t("Adiada")}: ${diaDaData(de, tag)} → ${diaDaData(para, tag)}`;
      case "concluida":
        return t("Concluída");
      case "reaberta":
        return t("Reaberta");
      case "cancelada":
        return t("Excluída do plano");
      case "entrou_no_cronograma":
        return t("Adicionada à semana");
      case "saiu_do_cronograma":
        return t("Removida da semana");
      default:
        return t("Fechamento da semana");
    }
  };

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
                  {s.feitas.length} {t("feitas")}
                </span>
                <span
                  className={s.nao_feitas.length > 0 ? "text-error-fg" : "text-muted-foreground"}
                >
                  {s.nao_feitas.length} {t("não feitas")}
                </span>
                <span className="font-semibold tabular-nums">
                  {s.nota === null ? t("Sem autoavaliação") : `${s.nota}%`}
                </span>
              </span>
            </button>
            {aberta ? (
              <div className="grid gap-4 border-t px-4 py-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ListaDeTarefas titulo={t("Executadas")} itens={s.feitas.map((x) => x.title)} />
                  <ListaDeTarefas
                    titulo={t("Não executadas")}
                    itens={s.nao_feitas.map((x) => x.title)}
                  />
                </div>
                {s.eventos.length > 0 ? (
                  <div className="grid gap-1.5">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                      {t("Movimentações")}
                    </h4>
                    <ul className="grid gap-1.5">
                      {s.eventos.map((e) => (
                        <li key={e.id} className="rounded-lg bg-secondary/40 px-3 py-2">
                          <span className="font-medium [overflow-wrap:anywhere]">
                            {e.titulo ?? "—"}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {texto(e.tipo, e.de_prazo, e.para_prazo)}
                          </span>
                          {e.motivo ? (
                            <p className="mt-0.5 text-muted-foreground">
                              {t("Por quê")}: {e.motivo}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ListaDeTarefas({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div className="grid content-start gap-1">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase">
        {titulo} ({itens.length})
      </h4>
      {itens.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul className="list-disc pl-5">
          {itens.map((n, i) => (
            <li key={i} className="[overflow-wrap:anywhere]">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
