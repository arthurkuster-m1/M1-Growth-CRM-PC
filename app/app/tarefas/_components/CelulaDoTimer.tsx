"use client";

import { useEffect, useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import {
  euCronometro,
  formatarDuracao,
  segundosDaTarefa,
  type CronometroRodando,
} from "@/lib/tarefas/tempo";
import { Pause, Play } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * A célula "Tempo" da tabela de Tarefas (o timer do ClickUp): ▶ começa a cronometrar quanto se leva
 * para fazer a tarefa, ⏸ para. O número é o total da tarefa (todos os lançamentos) e anda de
 * segundo em segundo enquanto alguém cronometra. O relógio de verdade é o do banco; aqui só se
 * desenha a conta.
 */
export function CelulaDoTimer({
  tarefa,
  userId,
  podeEditar,
  aoIniciar,
  aoParar,
}: {
  tarefa: {
    status: string;
    tempo_gasto_seg?: number;
    cronometros?: CronometroRodando[];
  };
  userId: string;
  podeEditar: boolean;
  aoIniciar: () => void;
  aoParar: () => void;
}) {
  const t = useT();
  const meu = euCronometro(tarefa, userId);
  const rodando = (tarefa.cronometros ?? []).length > 0;
  const outros = (tarefa.cronometros ?? []).filter((c) => c.user_id !== userId).length;
  const encerrada = tarefa.status === "done" || tarefa.status === "cancelled";
  const [agora, setAgora] = useState(() => Date.now());

  // Só tem relógio andando quando há cronômetro rodando.
  useEffect(() => {
    if (!rodando) return;
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rodando]);

  const total = segundosDaTarefa(tarefa, rodando ? agora : Date.now());
  const podeMexer = podeEditar && (meu !== undefined || !encerrada);

  return (
    <div className="flex items-center gap-2 px-2">
      <button
        type="button"
        disabled={!podeMexer}
        aria-label={meu ? t("Parar o cronômetro") : t("Iniciar o cronômetro")}
        title={
          meu
            ? t("Parar o cronômetro")
            : encerrada
              ? t("Tarefa concluída: reabra para cronometrar")
              : t("Iniciar o cronômetro")
        }
        onClick={(e) => {
          e.stopPropagation();
          if (meu) aoParar();
          else aoIniciar();
        }}
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-40",
          meu
            ? "border-primary bg-primary text-primary-foreground"
            : "text-muted-foreground hover:border-primary hover:text-primary",
        )}
      >
        {meu ? (
          <Pause size={13} weight="fill" aria-hidden />
        ) : (
          <Play size={13} weight="fill" aria-hidden />
        )}
      </button>
      <span
        className={cn(
          "text-sm tabular-nums",
          rodando ? "font-medium text-primary" : total === 0 ? "text-text-subtle" : "",
        )}
        data-testid="tempo-da-tarefa"
      >
        {total === 0 && !rodando ? "0:00" : formatarDuracao(total)}
      </span>
      {outros > 0 ? (
        <span
          className="rounded-full bg-secondary px-1.5 text-[11px] text-muted-foreground"
          title={t("Outras pessoas estão cronometrando esta tarefa")}
        >
          +{outros}
        </span>
      ) : null}
    </div>
  );
}
