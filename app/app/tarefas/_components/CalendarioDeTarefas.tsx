"use client";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  DragOverlay,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";

import type { ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { BASE_DA_COR, estiloDaEtiqueta } from "@/lib/motor/cores";
import { useT } from "@/hooks/i18n/useT";
import { chaveDoDia } from "@/lib/inicio/datas";
import { diasDaGradeDoMes, inicioDoMes, somarMeses, trocarODia } from "@/lib/motor/calendario";
import { opcaoDaTarefa, type CorDaOpcao, type OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import type { Tarefa } from "@/lib/tarefas/tipos";
import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { soDeDentro } from "@/lib/ui/so-de-dentro";

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
  aoAbrir: (tarefa: Tarefa) => void;
  /**
   * As propriedades que a pessoa escolheu mostrar DENTRO de cada tarefa (status, responsável…).
   * Cada uma é a mesma célula editável da tabela; vazio = só o título, como sempre foi.
   */
  colunas?: ColunaDoMotor<Tarefa>[];
}

/**
 * O CALENDÁRIO — um mês por vez, cada tarefa no dia do prazo. Arrasta-se a tarefa para outro
 * dia (o prazo muda, a hora fica); no celular, segura-se um instante para arrastar, ou toca-se
 * no dia e a lista dele aparece embaixo. As tarefas sem prazo ficam numa faixa à parte e
 * também se arrastam para um dia — é o que dá a elas o prazo.
 *
 * Com propriedades escolhidas, a tarefa vira um bloquinho editável (como no Notion): o título
 * em cima e as propriedades embaixo.
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
  aoAbrir,
  colunas = [],
}: Props) {
  const t = useT();
  const [mes, setMes] = useState(() => inicioDoMes(hoje));
  const [escolhido, setEscolhido] = useState(hoje);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  // Os dias em que a pessoa abriu o "+N" para ver todas as tarefas.
  const [expandidos, setExpandidos] = useState<ReadonlySet<string>>(() => new Set());
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
    setArrastandoId(null);
    const destino = e.over ? String(e.over.id) : null;
    const tarefa = tarefas.find((x) => x.id === e.active.id);
    if (!destino || !tarefa) return;
    if (tarefa.due_date && chaveDoDia(new Date(tarefa.due_date), fuso) === destino) return;
    // Muda o DIA e mantém a hora de parede (14:00 continua 14:00). Sem prazo ainda: começa no dia.
    aoMudarPrazo(tarefa, trocarODia(tarefa.due_date, destino, fuso));
  }

  const corDaTarefa = (tarefa: Tarefa): CorDaOpcao =>
    opcaoDaTarefa(tarefa, opcoes)?.color ?? "gray";
  const corDe = (tarefa: Tarefa) => estiloDaEtiqueta(corDaTarefa(tarefa));
  const arrastada = arrastandoId ? tarefas.find((x) => x.id === arrastandoId) : undefined;
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

      <DndContext
        sensors={sensores}
        onDragStart={(e: DragStartEvent) => setArrastandoId(String(e.active.id))}
        onDragCancel={() => setArrastandoId(null)}
        onDragEnd={aoSoltar}
      >
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
                corDaTarefa={corDaTarefa}
                podeEditar={podeEditar}
                aoAbrir={aoAbrir}
                colunas={colunas}
                expandido={expandidos.has(dia)}
                aoExpandir={() =>
                  setExpandidos((atual) => {
                    const novo = new Set(atual);
                    if (novo.has(dia)) novo.delete(dia);
                    else novo.add(dia);
                    return novo;
                  })
                }
                arrastandoId={arrastandoId}
              />
            ))}
          </div>
        </div>

        {/* Celular: a lista do dia tocado. No computador também serve de detalhe do dia. */}
        <section
          aria-label={nomeDoDia(escolhido, "longo")}
          className="rounded-2xl border bg-card p-3 md:hidden"
        >
          {/* O título numa linha só e o botão "Nova tarefa", pequeno, na linha de baixo, à direita —
              nada quebra em duas linhas no celular. */}
          <div className="mb-2 flex flex-col gap-1">
            <h3 className="truncate text-sm font-semibold whitespace-nowrap capitalize">
              {nomeDoDia(escolhido, "longo")}
            </h3>
            {podeEditar && aoCriarNoDia ? (
              <button
                type="button"
                onClick={() => aoCriarNoDia(escolhido)}
                className="h-7 self-end rounded-lg px-2.5 text-xs font-medium whitespace-nowrap text-primary hover:bg-secondary"
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
                <li key={tarefa.id}>
                  <button
                    type="button"
                    onClick={() => aoAbrir(tarefa)}
                    style={corDe(tarefa)}
                    className={cn(
                      "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium",
                      colunas.length > 0 ? "[overflow-wrap:anywhere]" : "truncate",
                    )}
                  >
                    {tarefa.title}
                  </button>
                  {/* As propriedades escolhidas na configuração da visualização aparecem aqui,
                      sob cada tarefa do dia (mexer nelas não abre a tarefa). */}
                  {colunas.length > 0 ? (
                    <div
                      className="mt-1 flex flex-col gap-0.5 px-1"
                      onClick={soDeDentro}
                      onKeyDown={soDeDentro}
                      onPointerDown={soDeDentro}
                      onMouseDown={soDeDentro}
                      onTouchStart={soDeDentro}
                    >
                      {colunas.map((c) => (
                        <div key={c.id} className="min-w-0 text-xs">
                          {c.celula(tarefa)}
                        </div>
                      ))}
                    </div>
                  ) : null}
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
            {podeEditar ? (
              <p className="mb-2 text-xs text-muted-foreground">
                {t("Arraste uma tarefa para um dia do calendário para dar a ela esse prazo.")}
              </p>
            ) : null}
            <ul className="flex flex-wrap gap-1.5">
              {semPrazo.map((tarefa) => (
                <li key={tarefa.id} className="max-w-full">
                  <ChipSemPrazo
                    tarefa={tarefa}
                    estilo={corDe(tarefa)}
                    arrastavel={podeEditar}
                    aoAbrir={aoAbrir}
                    escondida={arrastandoId === tarefa.id}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <DragOverlay dropAnimation={null}>
          {arrastada ? (
            <div
              style={corDe(arrastada)}
              className="max-w-56 cursor-grabbing truncate rounded-md px-2 py-1 text-xs font-medium shadow-xl ring-1 ring-primary/40"
            >
              {arrastada.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
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
  corDaTarefa,
  podeEditar,
  aoAbrir,
  colunas,
  expandido,
  aoExpandir,
  arrastandoId,
}: {
  dia: string;
  doMes: boolean;
  ehHoje: boolean;
  escolhido: boolean;
  aoEscolher: () => void;
  tarefas: Tarefa[];
  corDe: (t: Tarefa) => React.CSSProperties;
  corDaTarefa: (t: Tarefa) => CorDaOpcao;
  podeEditar: boolean;
  aoAbrir: (tarefa: Tarefa) => void;
  colunas: ColunaDoMotor<Tarefa>[];
  expandido: boolean;
  aoExpandir: () => void;
  arrastandoId: string | null;
}) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: dia });
  // Com propriedades dentro da tarefa o bloquinho é maior: cabem menos por dia sem abrir o "+N".
  const MAXIMO = colunas.length > 0 ? 2 : 3;
  const visiveis = expandido ? tarefas : tarefas.slice(0, MAXIMO);
  return (
    <div
      ref={setNodeRef}
      onClick={aoEscolher}
      className={cn(
        "min-h-14 cursor-pointer border-r border-b p-1 transition-colors md:min-h-28",
        !doMes && "bg-secondary/30 text-muted-foreground",
        escolhido && "bg-primary/5 md:bg-transparent",
        isOver && "bg-primary/10 ring-2 ring-primary/40 ring-inset",
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
        {visiveis.map((tarefa) => (
          <Chip
            key={tarefa.id}
            tarefa={tarefa}
            estilo={corDe(tarefa)}
            cor={corDaTarefa(tarefa)}
            arrastavel={podeEditar}
            aoAbrir={aoAbrir}
            colunas={colunas}
            escondida={arrastandoId === tarefa.id}
          />
        ))}
        {tarefas.length > MAXIMO ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              aoExpandir();
            }}
            className="rounded-md px-1 text-left text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {expandido ? t("Mostrar menos") : `+${tarefas.length - MAXIMO}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  tarefa,
  estilo,
  cor,
  arrastavel,
  aoAbrir,
  colunas,
  escondida,
}: {
  tarefa: Tarefa;
  estilo: React.CSSProperties;
  cor: CorDaOpcao;
  arrastavel: boolean;
  aoAbrir: (tarefa: Tarefa) => void;
  colunas: ColunaDoMotor<Tarefa>[];
  escondida: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: tarefa.id,
    disabled: !arrastavel,
  });
  const comPropriedades = colunas.length > 0;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        aoAbrir(tarefa);
      }}
      title={tarefa.title}
      style={comPropriedades ? { borderLeftColor: BASE_DA_COR[cor] } : estilo}
      className={cn(
        comPropriedades
          ? "min-w-0 rounded-md border border-l-[3px] bg-card px-1.5 py-1 text-xs shadow-sm"
          : "truncate rounded-md px-1.5 py-0.5 text-xs font-medium",
        arrastavel && "cursor-grab active:cursor-grabbing",
        escondida && "opacity-40",
      )}
    >
      {comPropriedades ? (
        <>
          <p
            className={cn(
              "truncate font-medium",
              tarefa.status === "done" && "text-muted-foreground line-through",
            )}
          >
            {tarefa.title}
          </p>
          {/* Mexer numa propriedade não pode abrir a tarefa nem começar um arrasto. */}
          <div
            className="mt-1 flex flex-col gap-0.5"
            onClick={soDeDentro}
            onKeyDown={soDeDentro}
            onPointerDown={soDeDentro}
            onMouseDown={soDeDentro}
            onTouchStart={soDeDentro}
          >
            {colunas.map((c) => (
              <div key={c.id} className="-mx-1 min-w-0 text-[11px]">
                {c.celula(tarefa)}
              </div>
            ))}
          </div>
        </>
      ) : (
        tarefa.title
      )}
    </div>
  );
}

/** A tarefa sem prazo na faixa de baixo: arrasta-se para um dia e ela ganha esse prazo. */
function ChipSemPrazo({
  tarefa,
  estilo,
  arrastavel,
  aoAbrir,
  escondida,
}: {
  tarefa: Tarefa;
  estilo: React.CSSProperties;
  arrastavel: boolean;
  aoAbrir: (tarefa: Tarefa) => void;
  escondida: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: tarefa.id,
    disabled: !arrastavel,
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={() => aoAbrir(tarefa)}
      style={estilo}
      className={cn(
        "block max-w-full truncate rounded-md px-2 py-1 text-xs font-medium",
        arrastavel && "cursor-grab active:cursor-grabbing",
        escondida && "opacity-40",
      )}
    >
      {tarefa.title}
    </button>
  );
}
