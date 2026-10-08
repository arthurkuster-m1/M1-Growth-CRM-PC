"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { opcaoDaTarefa, type CorDaOpcao, type OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import { estaAtrasada, type PrioridadeDaTarefa, type Tarefa } from "@/lib/tarefas/tipos";
import { cn } from "@/lib/utils";

interface Props {
  tarefas: Tarefa[];
  opcoes: OpcaoDeStatus[];
  prioridades: { id: PrioridadeDaTarefa; rotulo: string; cor: CorDaOpcao }[];
  membros: { id: string; nome: string }[];
  agora: Date;
  /** Texto do prazo já formatado no fuso da organização. */
  rotuloDoPrazo: (iso: string) => string;
  podeEditar: boolean;
  aoMudarStatus: (tarefa: Tarefa, opcao: OpcaoDeStatus) => void;
}

/**
 * O QUADRO — uma coluna por opção de status, um cartão por tarefa. Arrastar o cartão para
 * outra coluna é trocar o status (o grupo acompanha, pelo trigger do banco). A ordem dentro
 * da coluna é a ordem manual da tabela.
 *
 * Mostra as MESMAS tarefas da tabela, já filtradas e ordenadas pela barra de consulta.
 */
export function QuadroKanban({
  tarefas,
  opcoes,
  prioridades,
  membros,
  agora,
  rotuloDoPrazo,
  podeEditar,
  aoMudarStatus,
}: Props) {
  const t = useT();
  // 6 px de arrasto antes de começar: um clique simples não vira arrasto sem querer.
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const porOpcao = new Map<string, Tarefa[]>(opcoes.map((o) => [o.id, []]));
  for (const tarefa of tarefas) {
    const opcao = opcaoDaTarefa(tarefa, opcoes);
    if (opcao) porOpcao.get(opcao.id)?.push(tarefa);
  }

  function aoSoltar(evento: DragEndEvent) {
    const destino = opcoes.find((o) => o.id === evento.over?.id);
    const tarefa = tarefas.find((x) => x.id === evento.active.id);
    if (!destino || !tarefa) return;
    if (opcaoDaTarefa(tarefa, opcoes)?.id === destino.id) return;
    aoMudarStatus(tarefa, destino);
  }

  if (opcoes.length === 0) {
    return <p className="px-1 text-sm text-muted-foreground">{t("Nenhuma opção de status.")}</p>;
  }

  return (
    <DndContext sensors={sensores} onDragEnd={aoSoltar}>
      <div className="flex items-start gap-3 overflow-x-auto pb-3">
        {opcoes.map((opcao) => (
          <Coluna key={opcao.id} opcao={opcao} quantidade={porOpcao.get(opcao.id)?.length ?? 0}>
            {(porOpcao.get(opcao.id) ?? []).map((tarefa) => {
              const prioridade = prioridades.find((p) => p.id === tarefa.priority);
              const responsavel = membros.find((m) => m.id === tarefa.assigned_to);
              return (
                <Cartao key={tarefa.id} id={tarefa.id} arrastavel={podeEditar}>
                  <p
                    className={cn(
                      "text-sm leading-snug font-medium",
                      tarefa.status === "done" && "text-muted-foreground line-through",
                    )}
                  >
                    {tarefa.title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {prioridade ? (
                      <Etiqueta cor={prioridade.cor}>{prioridade.rotulo}</Etiqueta>
                    ) : null}
                    {tarefa.due_date ? (
                      <span
                        className={cn(
                          "text-xs text-muted-foreground",
                          estaAtrasada(tarefa, agora) && "font-medium text-error-fg",
                        )}
                      >
                        {rotuloDoPrazo(tarefa.due_date)}
                      </span>
                    ) : null}
                  </div>
                  {responsavel ? (
                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      {responsavel.nome}
                    </p>
                  ) : null}
                </Cartao>
              );
            })}
          </Coluna>
        ))}
      </div>
      {podeEditar ? (
        <p className="text-xs text-muted-foreground">
          {t("Arraste o cartão para outra coluna para mudar o status.")}
        </p>
      ) : null}
    </DndContext>
  );
}

function Coluna({
  opcao,
  quantidade,
  children,
}: {
  opcao: OpcaoDeStatus;
  quantidade: number;
  children: React.ReactNode;
}) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: opcao.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={opcao.name}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-2xl bg-secondary/50 p-2.5 transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-center gap-2 px-1 py-0.5">
        <Etiqueta cor={opcao.color}>{opcao.name}</Etiqueta>
        <span className="text-xs text-muted-foreground">{quantidade}</span>
      </header>
      <div className="flex min-h-12 flex-col gap-2">
        {children}
        {quantidade === 0 && isOver ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">{t("Solte aqui")}</p>
        ) : null}
      </div>
    </section>
  );
}

function Cartao({
  id,
  arrastavel,
  children,
}: {
  id: string;
  arrastavel: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: !arrastavel,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-sm",
        arrastavel && "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "relative z-10 opacity-90 shadow-lg",
      )}
    >
      {children}
    </div>
  );
}
