"use client";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useState } from "react";

import { estiloDaEtiqueta } from "@/lib/motor/cores";
import { useT } from "@/hooks/i18n/useT";
import { chaveDoDia, inicioDoDia, partesNoFuso } from "@/lib/inicio/datas";
import { diasDaGradeDoMes, inicioDoMes, somarMeses } from "@/lib/motor/calendario";
import { opcaoDaTarefa, type OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import type { Tarefa } from "@/lib/tarefas/tipos";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  tarefas: Tarefa[];
  opcoes: OpcaoDeStatus[];
  fuso: string;
  tag: string;
  hoje: string;
  podeEditar: boolean;
  /** Muda o prazo de uma tarefa (ISO) — mantém a hora que ela já tinha. */
  aoMudarPrazo: (tarefa: Tarefa, iso: string) => void;
  /** Cria uma tarefa já com prazo no dia. */
  aoCriarNoDia?: (dia: string) => void;
}

/**
 * O CALENDÁRIO — um mês por vez, cada tarefa no dia do prazo. No computador, arrasta-se a
 * tarefa para outro dia; no celular, toca-se no dia e a lista dele aparece embaixo.
 * Tarefas sem prazo ficam numa faixa à parte.
 */
export function CalendarioDeTarefas({
  tarefas,
  opcoes,
  fuso,
  tag,
  hoje,
  podeEditar,
  aoMudarPrazo,
  aoCriarNoDia,
}: Props) {
  const t = useT();
  const [mes, setMes] = useState(() => inicioDoMes(hoje));
  const [escolhido, setEscolhido] = useState(hoje);
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const dias = diasDaGradeDoMes(mes);
  const porDia = new Map<string, Tarefa[]>();
  const semPrazo: Tarefa[] = [];
  for (const tarefa of tarefas) {
    if (!tarefa.due_date) {
      semPrazo.push(tarefa);
      continue;
    }
    const chave = chaveDoDia(new Date(tarefa.due_date), fuso);
    porDia.set(chave, [...(porDia.get(chave) ?? []), tarefa]);
  }

  const nomeDoMes = new Intl.DateTimeFormat(tag, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${mes}T12:00:00Z`));
  const nomeDoDia = (chave: string, formato: "curto" | "longo") =>
    new Intl.DateTimeFormat(tag, {
      weekday: formato === "curto" ? "short" : "long",
      ...(formato === "longo" ? { day: "numeric", month: "long" } : {}),
      timeZone: "UTC",
    }).format(new Date(`${chave}T12:00:00Z`));

  function aoSoltar(e: DragEndEvent) {
    const destino = e.over ? String(e.over.id) : null;
    const tarefa = tarefas.find((x) => x.id === e.active.id);
    if (!destino || !tarefa?.due_date) return;
    const atual = new Date(tarefa.due_date);
    if (chaveDoDia(atual, fuso) === destino) return;
    // Muda o DIA e mantém a hora de parede (14:00 continua 14:00).
    const p = partesNoFuso(atual, fuso);
    const novo = new Date(inicioDoDia(destino, fuso).getTime() + (p.hora * 60 + p.minuto) * 60_000);
    aoMudarPrazo(tarefa, novo.toISOString());
  }

  const corDe = (tarefa: Tarefa) =>
    estiloDaEtiqueta(opcaoDaTarefa(tarefa, opcoes)?.color ?? "gray");
  const doDiaEscolhido = porDia.get(escolhido) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold capitalize">{nomeDoMes}</h2>
        <button
          type="button"
          onClick={() => {
            setMes(inicioDoMes(hoje));
            setEscolhido(hoje);
          }}
          className="h-8 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {t("Hoje")}
        </button>
        <button
          type="button"
          aria-label={t("Mês anterior")}
          onClick={() => setMes((m) => somarMeses(m, -1))}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
        >
          <CaretLeft size={16} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t("Próximo mês")}
          onClick={() => setMes((m) => somarMeses(m, 1))}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
        >
          <CaretRight size={16} aria-hidden />
        </button>
      </div>

      <DndContext sensors={sensores} onDragEnd={aoSoltar}>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="grid grid-cols-7 border-b bg-secondary/50 text-center text-xs font-medium text-muted-foreground">
            {dias.slice(0, 7).map((d) => (
              <div key={d} className="py-2 capitalize">
                {nomeDoDia(d, "curto")}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((dia) => (
              <Dia
                key={dia}
                dia={dia}
                doMes={dia.slice(0, 7) === mes.slice(0, 7)}
                ehHoje={dia === hoje}
                escolhido={dia === escolhido}
                aoEscolher={() => setEscolhido(dia)}
                tarefas={porDia.get(dia) ?? []}
                corDe={corDe}
                podeEditar={podeEditar}
              />
            ))}
          </div>
        </div>
      </DndContext>

      {/* Celular: a lista do dia tocado. No computador também serve de detalhe do dia. */}
      <section
        aria-label={nomeDoDia(escolhido, "longo")}
        className="rounded-2xl border bg-card p-3 md:hidden"
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold capitalize">{nomeDoDia(escolhido, "longo")}</h3>
          {podeEditar && aoCriarNoDia ? (
            <button
              type="button"
              onClick={() => aoCriarNoDia(escolhido)}
              className="h-8 rounded-lg px-3 text-sm font-medium text-primary hover:bg-secondary"
            >
              {t("Nova tarefa")}
            </button>
          ) : null}
        </div>
        {doDiaEscolhido.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nenhuma tarefa neste dia.")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {doDiaEscolhido.map((tarefa) => (
              <li
                key={tarefa.id}
                style={corDe(tarefa)}
                className="truncate rounded-lg px-3 py-2 text-sm font-medium"
              >
                {tarefa.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      {semPrazo.length > 0 ? (
        <section className="rounded-2xl border bg-card p-3">
          <h3 className="mb-2 text-sm font-semibold">
            {t("Sem prazo")} <span className="text-muted-foreground">{semPrazo.length}</span>
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {semPrazo.map((tarefa) => (
              <li
                key={tarefa.id}
                style={corDe(tarefa)}
                className="max-w-full truncate rounded-md px-2 py-1 text-xs font-medium"
              >
                {tarefa.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Dia({
  dia,
  doMes,
  ehHoje,
  escolhido,
  aoEscolher,
  tarefas,
  corDe,
  podeEditar,
}: {
  dia: string;
  doMes: boolean;
  ehHoje: boolean;
  escolhido: boolean;
  aoEscolher: () => void;
  tarefas: Tarefa[];
  corDe: (t: Tarefa) => React.CSSProperties;
  podeEditar: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dia });
  const MAXIMO = 3;
  return (
    <div
      ref={setNodeRef}
      onClick={aoEscolher}
      className={cn(
        "min-h-14 cursor-pointer border-r border-b p-1 transition-colors md:min-h-28",
        !doMes && "bg-secondary/30 text-muted-foreground",
        escolhido && "bg-primary/5 md:bg-transparent",
        isOver && "bg-primary/10",
      )}
    >
      <span
        className={cn(
          "mx-auto grid h-6 w-6 place-items-center rounded-full text-xs md:mx-0",
          ehHoje && "bg-primary font-semibold text-primary-foreground",
        )}
      >
        {Number(dia.slice(8))}
      </span>
      {/* Celular: só pontinhos coloridos. */}
      <div className="mt-1 flex flex-wrap justify-center gap-0.5 md:hidden">
        {tarefas.slice(0, 4).map((tarefa) => (
          <span key={tarefa.id} style={corDe(tarefa)} className="h-1.5 w-1.5 rounded-full" />
        ))}
      </div>
      {/* Computador: as tarefas, arrastáveis. */}
      <div className="mt-1 hidden flex-col gap-0.5 md:flex">
        {tarefas.slice(0, MAXIMO).map((tarefa) => (
          <Chip key={tarefa.id} tarefa={tarefa} estilo={corDe(tarefa)} arrastavel={podeEditar} />
        ))}
        {tarefas.length > MAXIMO ? (
          <span className="px-1 text-[11px] text-muted-foreground">+{tarefas.length - MAXIMO}</span>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  tarefa,
  estilo,
  arrastavel,
}: {
  tarefa: Tarefa;
  estilo: React.CSSProperties;
  arrastavel: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tarefa.id,
    disabled: !arrastavel,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      title={tarefa.title}
      style={{
        ...estilo,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={cn(
        "truncate rounded-md px-1.5 py-0.5 text-xs font-medium",
        arrastavel && "cursor-grab active:cursor-grabbing",
        isDragging && "relative z-10 shadow-lg",
      )}
    >
      {tarefa.title}
    </div>
  );
}
