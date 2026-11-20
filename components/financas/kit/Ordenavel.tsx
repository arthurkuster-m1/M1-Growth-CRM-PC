"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical } from "@/lib/ui/icons";
import { cx } from "./cx";

/**
 * Reordenar por clique e arraste. A ALÇA (⋮⋮) é quem arrasta — o resto da linha continua clicável e a página rola normalmente
 * no celular. Funciona com mouse, toque e TECLADO (alça em foco: espaço levanta, setas movem, espaço solta, Esc cancela).
 * `contexto` identifica a lista: só se solta dentro da mesma lista em que se pegou.
 */
const ACESSIBILIDADE = {
  screenReaderInstructions: {
    draggable:
      "Para reordenar, aperte espaço, mova com as setas para cima e para baixo e aperte espaço de novo para soltar. Esc cancela.",
  },
  announcements: {
    onDragStart: () => "Item levantado.",
    onDragOver: () => undefined,
    onDragEnd: () => "Item solto na nova posição.",
    onDragCancel: () => "Reordenação cancelada.",
  },
};

export function OrdenavelRaiz({
  children,
  onSoltar,
  grade,
}: {
  children: ReactNode;
  grade?: boolean;
  onSoltar: (contexto: string, idAtivo: string, idSobre: string) => void;
}) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function fim(e: DragEndEvent) {
    const a = e.active.data.current?.contexto as string | undefined,
      o = e.over?.data.current?.contexto as string | undefined;
    if (!e.over || !a || a !== o || e.active.id === e.over.id) return;
    onSoltar(a, String(e.active.id), String(e.over.id));
  }
  return (
    <DndContext
      sensors={sensores}
      collisionDetection={(args) =>
        closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (c) => c.data.current?.contexto === args.active.data.current?.contexto,
          ),
        })
      }
      modifiers={grade ? [] : [({ transform }) => ({ ...transform, x: 0 })]}
      accessibility={ACESSIBILIDADE}
      onDragEnd={fim}
    >
      {children}
    </DndContext>
  );
}

export function ListaOrdenavel({
  ids,
  children,
  grade,
}: {
  ids: string[];
  children: ReactNode;
  grade?: boolean;
}) {
  return (
    <SortableContext
      items={ids}
      strategy={grade ? rectSortingStrategy : verticalListSortingStrategy}
    >
      {children}
    </SortableContext>
  );
}

export function ItemOrdenavel({
  id,
  contexto,
  nome,
  as: Tag = "li",
  className,
  children,
  ...resto
}: {
  id: string;
  contexto: string;
  nome: string;
  as?: "li" | "div" | "tr" | "tbody";
  className?: string;
  /** reservado: o item não tem alça própria */ semAlca?: boolean;
  "data-testid"?: string;
  children: (p: { alca: ReactNode; arrastando: boolean }) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { contexto } });
  const alca = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="fi-alca"
      aria-label={`Arrastar ${nome}`}
      {...attributes}
      {...listeners}
    >
      <DotsSixVertical size={22} weight="bold" aria-hidden />
    </button>
  );
  return (
    <Tag
      ref={setNodeRef as never}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(className, isDragging && "is-arrastando")}
      data-testid={resto["data-testid"]}
    >
      {children({ alca, arrastando: isDragging })}
    </Tag>
  );
}

export { arrayMove };
