"use client";

import Link from "next/link";
import { useMemo } from "react";

import { DiagramaDaRegra } from "@/components/automacoes/DiagramaDaRegra";
import { useT } from "@/hooks/i18n/useT";
import { regraParaDiagrama } from "@/lib/automation/regra-para-diagrama";
import { ArrowLeft } from "@/lib/ui/icons";
import {
  ACTION_LABELS,
  TRIGGER_LABELS,
  type ActionType,
  type TriggerEvent,
} from "@/app/app/webhooks/_components/labels";

export interface RegraDaTela {
  id: string;
  name: string;
  trigger_event: string;
  conditions: Array<{ field: string; op: "eq" | "neq" | "contains"; value: string }>;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  trigger_config: Record<string, unknown> | null;
  is_active: boolean;
  run_count: number;
}

export function TelaDaAutomacao({ regra }: { regra: RegraDaTela }) {
  const t = useT();
  const diagrama = useMemo(
    () =>
      regraParaDiagrama(regra, {
        gatilho: (id) => TRIGGER_LABELS[id as TriggerEvent] ?? id,
        acao: (id) => ACTION_LABELS[id as ActionType] ?? id,
      }),
    [regra],
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-[1100px] flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <Link
        href="/app/automacoes"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft size={14} aria-hidden />
        {t("Todas as automações")}
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{regra.name}</h1>
          <p className="text-sm text-muted-foreground">
            {regra.is_active ? t("Ligada") : t("Desligada")} · {regra.run_count}{" "}
            {regra.run_count === 1 ? t("execução") : t("execuções")}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          {t("Só visualização por enquanto")}
        </span>
      </header>
      <DiagramaDaRegra diagrama={diagrama} />
    </div>
  );
}
