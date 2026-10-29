"use client";

import { format, isToday, isYesterday, type Locale } from "date-fns";
import { useMemo } from "react";

import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { activityLabel, actorName, actorShape } from "@/lib/leads/activity-vocabulary";
import type { TimelineItemView } from "@/lib/types/contacts";
import {
  ArrowRight,
  Bell,
  CalendarBlank,
  CalendarCheck,
  CalendarX,
  ChatCircle,
  Clock,
  CurrencyDollar,
  Gear,
  NotePencil,
  Phone,
  Receipt,
  Robot,
  UserPlus,
  Users,
  CheckSquare,
} from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/**
 * A LINHA DO TEMPO, no desenho único do produto: a ficha do cliente (Histórico) e a Atividade da
 * oportunidade são a MESMA lista (as duas leem `crm_lead_activities`; muda só o recorte — o do
 * cliente inteiro ou o de uma oportunidade) e por isso se desenham com este componente.
 *
 * Um trilho vertical por dia, com um ícone colorido por tipo de acontecimento, o título com quem
 * fez e a hora, e uma linha de texto discreta com o detalhe.
 */

type Tom = "azul" | "roxo" | "ambar" | "verde" | "vermelho" | "cinza";

const TONS: Record<Tom, string> = {
  azul: "#3e63dd",
  roxo: "#ab4aba",
  ambar: "#c47f00",
  verde: "#00655a",
  vermelho: "#cf3716",
  cinza: "#6f6f6f",
};

/** Ícone e tom de cada tipo de acontecimento (o que não é conhecido cai no cinza neutro). */
export function aparenciaDoTipo(type: string): { Icone: PhosphorIcon; tom: Tom } {
  if (type === "lead_created") return { Icone: UserPlus, tom: "azul" };
  if (type === "stage_changed" || type === "moved_from_pipeline" || type === "agent_move_corrected") {
    return { Icone: ArrowRight, tom: "azul" };
  }
  if (type === "appointment_cancelled" || type === "appointment_no_show") {
    return { Icone: CalendarX, tom: "vermelho" };
  }
  if (type === "appointment_completed") return { Icone: CalendarCheck, tom: "roxo" };
  if (type.startsWith("appointment_")) return { Icone: CalendarBlank, tom: "roxo" };
  if (type.startsWith("task_")) return { Icone: CheckSquare, tom: "ambar" };
  if (type === "payment_overdue" || type === "payment_cancelled") {
    return { Icone: CurrencyDollar, tom: "vermelho" };
  }
  if (type.startsWith("payment_")) return { Icone: CurrencyDollar, tom: "verde" };
  if (type.startsWith("proposal_")) return { Icone: Receipt, tom: "verde" };
  if (type.startsWith("voice_call")) return { Icone: Phone, tom: "cinza" };
  if (type === "note" || type === "lead_edited") return { Icone: NotePencil, tom: "cinza" };
  if (type === "ai_turn" || type === "send_vetoed" || type.startsWith("handoff")) {
    return { Icone: Robot, tom: "cinza" };
  }
  if (type.startsWith("conversation_")) return { Icone: ChatCircle, tom: "cinza" };
  if (type.startsWith("followup_") || type.startsWith("next_action")) {
    return { Icone: Clock, tom: "ambar" };
  }
  if (type.startsWith("lead_") || type.startsWith("reactivation_")) return { Icone: Bell, tom: "ambar" };
  if (type === "lifecycle_changed" || type.startsWith("contact")) return { Icone: Users, tom: "cinza" };
  return { Icone: Gear, tom: "cinza" };
}

function rotuloDoDia(d: Date, t: (x: string) => string, locale: Locale): string {
  if (isToday(d)) return t("Hoje");
  if (isYesterday(d)) return t("Ontem");
  return format(d, "dd/MM/yyyy", { locale });
}

/** Só texto que uma pessoa escreveu ou leria — nunca o payload cru. */
function corpoDoPayload(p: Record<string, unknown> | null | undefined): string {
  if (!p) return "";
  for (const campo of ["body", "text", "summary", "reason", "note"]) {
    const v = p[campo];
    if (typeof v === "string" && v.trim() !== "") return v.slice(0, 200);
  }
  return "";
}

export function LinhaDoTempoVisual({
  itens,
  aoVivo,
}: {
  itens: readonly TimelineItemView[];
  /** Ids que chegaram por tempo real nesta sessão: ganham a marca "agora". */
  aoVivo?: ReadonlySet<string>;
}) {
  const t = useT();
  const locale = useLocaleDeData();

  const dias = useMemo(() => {
    const mapa = new Map<string, TimelineItemView[]>();
    for (const it of itens) {
      const chave = format(new Date(it.performed_at), "yyyy-MM-dd");
      const lista = mapa.get(chave) ?? [];
      lista.push(it);
      mapa.set(chave, lista);
    }
    return Array.from(mapa.entries());
  }, [itens]);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      {dias.map(([chave, lista]) => (
        <section key={chave} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
          <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {rotuloDoDia(new Date(`${chave}T12:00:00`), t, locale)}
          </h3>
          <ol className="relative ml-3.5 min-w-0 border-l pl-6">
            {lista.map((it) => {
              const { Icone, tom } = aparenciaDoTipo(it.type);
              const cor = TONS[tom];
              const payload = (it as { payload?: Record<string, unknown> | null }).payload;
              const titulo = t(activityLabel(it.type, payload));
              // A escrita é canônica em português: o motivo se traduz na LEITURA.
              const corpo = it.reason?.trim() ? t(it.reason.trim()) : corpoDoPayload(payload);
              const quem = actorName(
                it.actor_kind ?? null,
                { agente: it.actor_agent_name ?? null, usuario: it.actor_user_name ?? null },
                t,
              );
              const automatico = actorShape(it.actor_kind ?? null) !== "filled";
              return (
                <li key={it.id} className="relative min-w-0 pb-5 last:pb-0">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0 -left-[2.375rem] flex size-8 items-center justify-center rounded-full border-2 border-background",
                      automatico && "opacity-80",
                    )}
                    style={{
                      color: cor,
                      backgroundColor: `color-mix(in srgb, ${cor} 16%, var(--background, white))`,
                    }}
                  >
                    <Icone size={15} weight="duotone" aria-hidden />
                  </span>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-sm font-medium">
                      {titulo}
                      {aoVivo?.has(it.id) ? (
                        <span className="ml-1.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
                          {t("agora")}
                        </span>
                      ) : null}
                    </p>
                    <time
                      dateTime={it.performed_at}
                      className="shrink-0 text-xs text-muted-foreground tabular-nums"
                    >
                      {format(new Date(it.performed_at), "HH:mm", { locale })}
                    </time>
                  </div>
                  {quem ? <p className="text-xs text-muted-foreground">{quem}</p> : null}
                  {corpo ? (
                    <p
                      className="mt-1 text-sm break-words whitespace-pre-line text-foreground/80"
                      title={corpo}
                    >
                      {corpo}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
