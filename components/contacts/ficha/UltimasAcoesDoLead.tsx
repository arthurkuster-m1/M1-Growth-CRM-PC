"use client";

import { format } from "date-fns";

import { BlocoDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useTimeline } from "@/hooks/contacts/useTimeline";
import { useT } from "@/hooks/i18n/useT";
import { activityLabel, actorName } from "@/lib/leads/activity-vocabulary";
import type { TimelineItemView } from "@/lib/types/contacts";

/** Um texto legível do que a pessoa escreveu (nunca o JSON do payload). */
function corpoDe(it: TimelineItemView): string {
  const motivo = (it.reason ?? "").trim();
  if (motivo) return motivo;
  const p = (it.payload ?? {}) as Record<string, unknown>;
  for (const campo of ["body", "text", "summary", "reason", "note"]) {
    const v = p[campo];
    if (typeof v === "string" && v.trim() !== "") return v.slice(0, 200);
  }
  return "";
}

/** As 2 últimas ações da linha do tempo, na Visão geral. */
export function UltimasAcoesDoLead({
  contactId,
  aoVerTodas,
}: {
  contactId: string;
  aoVerTodas: () => void;
}) {
  const t = useT();
  const locale = useLocaleDeData();
  const q = useTimeline(contactId);
  const itens: TimelineItemView[] = (q.data?.pages.flatMap((p) => p.data) ?? []).slice(0, 2);

  return (
    <BlocoDaFicha
      titulo={t("Últimas ações")}
      cor="blue"
      acao={
        <button
          type="button"
          onClick={aoVerTodas}
          className="text-xs font-medium text-primary hover:underline"
        >
          {t("Ver linha do tempo")}
        </button>
      }
    >
      {q.isLoading ? (
        <div className="h-12 animate-pulse rounded-lg bg-secondary" />
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Nenhuma atividade registrada ainda.")}</p>
      ) : (
        <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
          {itens.map((it) => {
            const corpo = corpoDe(it);
            const quem = actorName(
              it.actor_kind ?? null,
              { agente: it.actor_agent_name, usuario: it.actor_user_name },
              t,
            );
            return (
              <li key={it.id} className="min-w-0 rounded-xl border p-3">
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <span className="min-w-0 max-w-full truncate text-sm font-medium">
                    {t(activityLabel(it.type, it.payload as Record<string, unknown> | null))}
                    {quem ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {quem}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(it.performed_at), "dd/MM/yyyy HH:mm", { locale })}
                  </span>
                </div>
                {corpo ? (
                  <p className="mt-1 line-clamp-3 text-sm [overflow-wrap:anywhere] text-muted-foreground" title={corpo}>
                    {corpo}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </BlocoDaFicha>
  );
}
