"use client";

import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import type { EventoDoHistorico } from "@/hooks/marketing/useCronograma";

const FUSO = "America/Sao_Paulo";
const dataHora = (iso: string, tag: string) =>
  new Date(iso).toLocaleString(tag, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO,
  });
const dia = (iso: string | null, tag: string) =>
  iso
    ? new Date(iso).toLocaleDateString(tag, { day: "2-digit", month: "2-digit", timeZone: FUSO })
    : "—";

/** O histórico da semana: o que foi feito, adiado ou cancelado e o PORQUÊ de cada mudança. */
export function HistoricoDaSemana({ eventos }: { eventos: EventoDoHistorico[] }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const texto = (e: EventoDoHistorico): string => {
    switch (e.tipo) {
      case "prazo_alterado":
        return `${t("Prazo")} ${dia(e.de_prazo, tag)} → ${dia(e.para_prazo, tag)}`;
      case "concluida":
        return t("Concluída");
      case "reaberta":
        return t("Reaberta");
      case "cancelada":
        return t("Cancelada");
      case "entrou_no_cronograma":
        return t("Entrou na semana");
      case "saiu_do_cronograma":
        return t("Saiu da semana");
      default:
        return t("Fechamento da semana");
    }
  };

  if (eventos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("Nada registrado nesta semana ainda.")}
      </p>
    );
  }
  return (
    <ul className="grid gap-2">
      {eventos.map((e) => (
        <li key={e.id} className="rounded-xl border bg-card p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{e.crm_tasks?.title ?? "—"}</span>
            <span className="text-xs text-muted-foreground">{dataHora(e.created_at, tag)}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {texto(e)}
            {e.crm_tasks && e.crm_tasks.adiamentos > 0
              ? ` · ${t("adiada")} ${e.crm_tasks.adiamentos}x`
              : ""}
          </p>
          {e.motivo ? (
            <p className="mt-1 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">{t("Por quê")}: </span>
              {e.motivo}
            </p>
          ) : e.tipo === "prazo_alterado" ? (
            <p className="mt-1 text-xs text-warning-fg">{t("Sem motivo registrado.")}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
