"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

import { useT } from "@/hooks/i18n/useT";
import { DotsSixVertical, Plus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface ColunaDoMotor<T> {
  id: string;
  titulo: string;
  icone?: ReactNode;
  /** Largura em px. */
  largura: number;
  /** Não pode ser escondida (o título). */
  fixa?: boolean;
  /** Visível quando o usuário ainda não escolheu nada. Padrão: sim. */
  padrao?: boolean;
  celula: (linha: T) => ReactNode;
}

interface Props<T> {
  linhas: readonly T[];
  idDe: (linha: T) => string;
  colunas: readonly ColunaDoMotor<T>[];
  /** Os ids das colunas visíveis, na ordem em que as colunas foram declaradas. */
  visiveis: readonly string[];
  /** `destino` = o índice em que a linha ficou, na lista já sem ela. */
  aoReordenar: (id: string, destino: number) => void;
  podeReordenar: boolean;
  carregando?: boolean;
  /** O botão "⋯" do fim da linha (menu de ações). */
  acoesDaLinha?: (linha: T) => ReactNode;
  aoCriar?: () => void;
  rotuloDeCriar?: string;
  /** Mostrado quando não há nenhuma linha. */
  vazio?: ReactNode;
  rotuloDaTabela: string;
}

const LARGURA_DO_ARRASTE = 32;
const LARGURA_DAS_ACOES = 44;

/** A linha só desliza no eixo vertical, como numa lista do Notion. */
const soVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function LinhaOrdenavel({
  id,
  grade,
  rotuloDoArraste,
  podeReordenar,
  children,
}: {
  id: string;
  grade: string;
  rotuloDoArraste: string;
  podeReordenar: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !podeReordenar });

  return (
    <div
      ref={setNodeRef}
      role="row"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        gridTemplateColumns: grade,
      }}
      className={cn(
        "group grid items-center border-b bg-card last:border-b-0",
        isDragging && "relative z-10 rounded-lg shadow-lg ring-1 ring-primary/30",
      )}
    >
      <div role="cell" className="grid place-items-center">
        {podeReordenar ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={rotuloDoArraste}
            className="grid h-7 w-6 cursor-grab touch-none place-items-center rounded text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary focus-visible:opacity-100 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <DotsSixVertical size={16} weight="bold" aria-hidden />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * A tabela estilo Notion: linhas que se arrastam pelo ícone, colunas que se escolhem,
 * células que se editam no lugar. Genérica de propósito — as Tarefas são a primeira a
 * usá-la, e o CRM e os outros módulos entram pela mesma porta (`ColunaDoMotor`).
 *
 * Não busca nem grava nada: recebe as linhas já ordenadas e avisa `aoReordenar`. Quem
 * decide o que fazer com a nova ordem (e o que mostrar no meio-tempo) é o dono dos dados.
 */
export function TabelaDoMotor<T>({
  linhas,
  idDe,
  colunas,
  visiveis,
  aoReordenar,
  podeReordenar,
  carregando = false,
  acoesDaLinha,
  aoCriar,
  rotuloDeCriar,
  vazio,
  rotuloDaTabela,
}: Props<T>) {
  const t = useT();
  const mostradas = colunas.filter((c) => c.fixa || visiveis.includes(c.id));
  const comAcoes = Boolean(acoesDaLinha);
  const grade = [
    `${LARGURA_DO_ARRASTE}px`,
    ...mostradas.map((c) => `${c.largura}px`),
    ...(comAcoes ? [`${LARGURA_DAS_ACOES}px`] : []),
  ].join(" ");
  const larguraTotal =
    LARGURA_DO_ARRASTE +
    mostradas.reduce((soma, c) => soma + c.largura, 0) +
    (comAcoes ? LARGURA_DAS_ACOES : 0);

  const sensores = useSensors(
    // 6px de tolerância: um clique tremido num botão de célula não pode virar arraste.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = linhas.map(idDe);

  function aoSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const destino = ids.indexOf(String(over.id));
    if (destino >= 0) aoReordenar(String(active.id), destino);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <div role="table" aria-label={rotuloDaTabela} style={{ minWidth: larguraTotal }}>
        <div
          role="row"
          style={{ gridTemplateColumns: grade }}
          className="grid items-center border-b bg-secondary/50 text-xs font-medium text-muted-foreground"
        >
          <div role="columnheader" aria-hidden />
          {mostradas.map((c) => (
            <div key={c.id} role="columnheader" className="flex items-center gap-1.5 px-2 py-2.5">
              {c.icone}
              <span className="truncate">{c.titulo}</span>
            </div>
          ))}
          {comAcoes ? <div role="columnheader" aria-hidden /> : null}
        </div>

        <div role="rowgroup">
          {carregando && linhas.length === 0 ? (
            <div className="space-y-2 p-3" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : linhas.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">{vazio}</div>
          ) : (
            <DndContext
              sensors={sensores}
              collisionDetection={closestCenter}
              modifiers={[soVertical]}
              onDragEnd={aoSoltar}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {linhas.map((linha) => (
                  <LinhaOrdenavel
                    key={idDe(linha)}
                    id={idDe(linha)}
                    grade={grade}
                    rotuloDoArraste={t("Arrastar para reordenar")}
                    podeReordenar={podeReordenar}
                  >
                    {mostradas.map((c) => (
                      <div key={c.id} role="cell" className="min-w-0 px-0.5 py-1">
                        {c.celula(linha)}
                      </div>
                    ))}
                    {comAcoes ? (
                      <div role="cell" className="grid place-items-center">
                        {acoesDaLinha!(linha)}
                      </div>
                    ) : null}
                  </LinhaOrdenavel>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {aoCriar ? (
          <button
            type="button"
            onClick={aoCriar}
            className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Plus size={14} aria-hidden />
            {rotuloDeCriar}
          </button>
        ) : null}
      </div>
    </div>
  );
}
