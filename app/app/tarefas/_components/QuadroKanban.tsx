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

import { Etiqueta } from "@/components/motor/Etiqueta";
import type { ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { useT } from "@/hooks/i18n/useT";
import { opcaoDaTarefa, type OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import type { Tarefa } from "@/lib/tarefas/tipos";
import { Plus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  tarefas: Tarefa[];
  opcoes: OpcaoDeStatus[];
  /**
   * As propriedades que o cartão mostra (as visíveis da visualização, sem o título e sem o
   * status, que já é a coluna). Cada uma é a MESMA célula editável da tabela.
   */
  colunas: ColunaDoMotor<Tarefa>[];
  podeEditar: boolean;
  aoMudarStatus: (tarefa: Tarefa, opcao: OpcaoDeStatus) => void;
  aoAbrir: (tarefa: Tarefa) => void;
  /** O "+ Nova tarefa" no pé da coluna: a tarefa já nasce com o status dela. */
  aoCriarNaColuna?: (opcao: OpcaoDeStatus) => void;
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
  colunas,
  podeEditar,
  aoMudarStatus,
  aoAbrir,
  aoCriarNaColuna,
}: Props) {
  const t = useT();
  // 6 px de arrasto antes de começar: um clique simples não vira arrasto sem querer.
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // No toque, segurar um instante para arrastar: deslizar o dedo continua rolando a tela.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

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
      <div className="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto pb-3 md:snap-none">
        {opcoes.map((opcao) => (
          <Coluna
            key={opcao.id}
            opcao={opcao}
            quantidade={porOpcao.get(opcao.id)?.length ?? 0}
            aoCriar={aoCriarNaColuna ? () => aoCriarNaColuna(opcao) : undefined}
          >
            {(porOpcao.get(opcao.id) ?? []).map((tarefa) => (
              <Cartao
                key={tarefa.id}
                id={tarefa.id}
                arrastavel={podeEditar}
                aoAbrir={() => aoAbrir(tarefa)}
              >
                <p
                  className={cn(
                    "text-sm leading-snug font-medium",
                    tarefa.status === "done" && "text-muted-foreground line-through",
                  )}
                >
                  {tarefa.title}
                </p>
                {colunas.length > 0 ? (
                  // Mexer numa propriedade do cartão não pode abrir a tarefa nem começar um arrasto.
                  <div
                    className="mt-1.5 flex flex-col gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {colunas.map((c) => (
                      <div key={c.id} className="-mx-1 min-w-0">
                        {c.celula(tarefa)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </Cartao>
            ))}
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
  aoCriar,
  children,
}: {
  opcao: OpcaoDeStatus;
  quantidade: number;
  aoCriar?: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: opcao.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={opcao.name}
      className={cn(
        "flex w-[85vw] max-w-72 shrink-0 snap-start flex-col gap-2 rounded-2xl bg-secondary/50 p-2.5 transition-colors md:w-72",
        isOver && "bg-primary/10 ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-center gap-2 px-1 py-0.5">
        <Etiqueta ponto cor={opcao.color}>
          {opcao.name}
        </Etiqueta>
        <span className="text-xs text-muted-foreground">{quantidade}</span>
      </header>
      <div className="flex min-h-12 flex-col gap-2">
        {children}
        {quantidade === 0 && isOver ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">{t("Solte aqui")}</p>
        ) : null}
      </div>
      {aoCriar ? (
        <button
          type="button"
          onClick={aoCriar}
          className="flex h-9 items-center gap-1.5 rounded-xl px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Plus size={14} aria-hidden />
          {t("Nova tarefa")}
        </button>
      ) : null}
    </section>
  );
}

function Cartao({
  id,
  arrastavel,
  aoAbrir,
  children,
}: {
  id: string;
  arrastavel: boolean;
  aoAbrir: () => void;
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
      onClick={aoAbrir}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter") aoAbrir();
      }}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-sm",
        arrastavel && "cursor-grab active:cursor-grabbing",
        isDragging && "relative z-10 opacity-90 shadow-lg",
      )}
    >
      {children}
    </div>
  );
}
