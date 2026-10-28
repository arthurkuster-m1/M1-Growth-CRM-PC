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
import { useState, type ReactNode } from "react";

import { Etiqueta } from "@/components/motor/Etiqueta";
import type { ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { useT } from "@/hooks/i18n/useT";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { cn } from "@/lib/utils";
import { soDeDentro } from "@/lib/ui/so-de-dentro";

export interface ColunaDoQuadro {
  /** Chave da coluna no grupo. */
  chave: string;
  nome: string;
  cor: CorDaOpcao;
  /** A etapa de cada funil do grupo que esta coluna representa (funil → etapa). */
  porFunil: Record<string, string>;
}

export interface GrupoDoQuadro {
  chave: string;
  titulo: string | null;
  colunas: ColunaDoQuadro[];
}

interface Props<T> {
  grupos: readonly GrupoDoQuadro[];
  linhas: readonly T[];
  idDe: (l: T) => string;
  etapaDe: (l: T) => string | undefined;
  funilDe: (l: T) => string | undefined;
  tituloDe: (l: T) => string;
  /** As propriedades visíveis da visualização que o cartão mostra (sem nome e etapa). */
  colunas: ColunaDoMotor<T>[];
  podeEditar: boolean;
  aoMover: (l: T, etapaIdAlvo: string) => void;
  aoAbrir: (l: T) => void;
  /** O total da coluna (ex.: soma dos valores). */
  totalDe?: (itens: readonly T[]) => ReactNode;
}

/**
 * O QUADRO das oportunidades no estilo do Notion (como o das Tarefas): uma coluna por etapa do
 * funil, um cartão por oportunidade, com as MESMAS propriedades e células editáveis da tabela, já
 * filtradas, ordenadas e agrupadas pela barra de consulta. Arrastar muda a etapa. Em "Todas",
 * cada grupo de funis com as mesmas etapas é um quadro, um em cima do outro.
 */
export function QuadroDeOportunidades<T>(props: Props<T>) {
  const t = useT();
  if (props.grupos.length === 0) {
    return <p className="px-1 text-sm text-muted-foreground">{t("Nenhuma etapa para mostrar.")}</p>;
  }
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8">
      {props.grupos.map((g) => (
        <section key={g.chave} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
          {g.titulo ? <h2 className="text-sm font-semibold">{g.titulo}</h2> : null}
          <Quadro {...props} grupo={g} />
        </section>
      ))}
    </div>
  );
}

function Quadro<T>({
  grupo,
  linhas,
  idDe,
  etapaDe,
  funilDe,
  tituloDe,
  colunas,
  podeEditar,
  aoMover,
  aoAbrir,
  totalDe,
}: Props<T> & { grupo: GrupoDoQuadro }) {
  const t = useT();
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const [arrastando, setArrastando] = useState(false);

  const colunaDe = new Map<string, string>();
  for (const c of grupo.colunas) {
    for (const etapa of Object.values(c.porFunil)) colunaDe.set(etapa, c.chave);
  }
  const porColuna = new Map<string, T[]>(grupo.colunas.map((c) => [c.chave, []]));
  for (const l of linhas) {
    const chave = colunaDe.get(etapaDe(l) ?? "");
    if (chave) porColuna.get(chave)?.push(l);
  }

  function aoSoltar(e: DragEndEvent) {
    setArrastando(false);
    const destino = grupo.colunas.find((c) => c.chave === e.over?.id);
    const linha = linhas.find((l) => idDe(l) === e.active.id);
    if (!destino || !linha) return;
    const funil = funilDe(linha);
    const etapaAlvo = funil ? destino.porFunil[funil] : undefined;
    if (!etapaAlvo || etapaAlvo === etapaDe(linha)) return;
    aoMover(linha, etapaAlvo);
  }

  return (
    <DndContext
      sensors={sensores}
      onDragStart={() => setArrastando(true)}
      onDragCancel={() => setArrastando(false)}
      onDragEnd={aoSoltar}
      autoScroll={{ acceleration: 3, interval: 20, threshold: { x: 0.14, y: 0.15 } }}
    >
      <div
        className={cn(
          "flex items-start gap-3 overflow-x-auto pb-3 md:snap-none",
          !arrastando && "snap-x snap-mandatory",
        )}
      >
        {grupo.colunas.map((c) => {
          const itens = porColuna.get(c.chave) ?? [];
          return (
            <Coluna
              key={c.chave}
              id={c.chave}
              nome={c.nome}
              cor={c.cor}
              quantidade={itens.length}
              total={totalDe?.(itens)}
            >
              {itens.map((l) => (
                <Cartao
                  key={idDe(l)}
                  id={idDe(l)}
                  arrastavel={podeEditar}
                  aoAbrir={() => aoAbrir(l)}
                >
                  <p className="text-sm leading-snug font-semibold [overflow-wrap:anywhere]">
                    {tituloDe(l)}
                  </p>
                  {colunas.length > 0 ? (
                    <div
                      className="mt-1.5 flex flex-col gap-1"
                      onClick={soDeDentro}
                      onKeyDown={soDeDentro}
                      onPointerDown={soDeDentro}
                      onMouseDown={soDeDentro}
                      onTouchStart={soDeDentro}
                    >
                      {colunas.map((col) => (
                        <div key={col.id} className="min-w-0">
                          {/* O nome da propriedade, pequeno: sem ele os valores soltos não dizem o que são. */}
                          <p className="truncate text-[10px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
                            {col.titulo}
                          </p>
                          <div className="-mx-1 min-w-0">{col.celula(l)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Cartao>
              ))}
            </Coluna>
          );
        })}
      </div>
      {podeEditar ? (
        <p className="text-xs text-muted-foreground">
          {t("Arraste o cartão para outra coluna para mudar a etapa.")}
        </p>
      ) : null}
    </DndContext>
  );
}

function Coluna({
  id,
  nome,
  cor,
  quantidade,
  total,
  children,
}: {
  id: string;
  nome: string;
  cor: CorDaOpcao;
  quantidade: number;
  total?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={nome}
      className={cn(
        "flex w-[85vw] max-w-80 min-w-0 shrink-0 snap-start flex-col gap-2 rounded-2xl bg-secondary/50 p-2.5 transition-colors md:w-80",
        isOver && "bg-primary/10 ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-center gap-2 px-1 py-0.5">
        <Etiqueta ponto cor={cor}>
          {nome}
        </Etiqueta>
        <span className="text-xs text-muted-foreground">{quantidade}</span>
        {total ? (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{total}</span>
        ) : null}
      </header>
      <div className="flex min-h-12 min-w-0 flex-col gap-2">
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
  aoAbrir,
  children,
}: {
  id: string;
  arrastavel: boolean;
  aoAbrir: () => void;
  children: ReactNode;
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
        "min-w-0 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm",
        arrastavel && "cursor-grab active:cursor-grabbing",
        isDragging && "relative z-10 opacity-90 shadow-lg",
      )}
    >
      {children}
    </div>
  );
}
