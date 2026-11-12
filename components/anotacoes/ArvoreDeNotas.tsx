"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/i18n/useT";
import { montarArvore, type NoDaArvore, type ResumoDaNota } from "@/lib/anotacoes/paginas";
import { lacunaAcabou, posicaoEntre, renumerar } from "@/lib/motor/ordem";
import {
  ArrowBendUpLeft,
  CaretDown,
  CaretRight,
  DotsSixVertical,
  DotsThree,
  Eye,
  EyeSlash,
  FileText,
  Plus,
  Trash,
} from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Acoes {
  selecionada: string | null;
  podeEditar: boolean;
  abertas: Set<string>;
  alternar: (id: string) => void;
  abrir: (id: string) => void;
  criar: (parentId: string | null) => void;
  apagar: (id: string) => void;
  mover: (id: string) => void;
  mudarVisibilidade: (id: string, visivel: boolean) => void;
}

function Linha({ no, nivel, acoes }: { no: NoDaArvore; nivel: number; acoes: Acoes }) {
  const t = useT();
  const { nota, filhas } = no;
  const aberta = acoes.abertas.has(nota.id);
  const ativa = acoes.selecionada === nota.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: nota.id,
    disabled: !acoes.podeEditar,
  });

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div
        className={cn(
          "group relative flex items-center gap-1 rounded-lg py-1 pr-1 text-[13px]",
          ativa ? "bg-card font-medium shadow-sm ring-1 ring-border/70" : "hover:bg-card/70",
          isDragging && "opacity-60",
        )}
        style={{ paddingLeft: 4 + nivel * 14 }}
      >
        {acoes.podeEditar ? (
          <button
            type="button"
            aria-label={t("Arrastar para reordenar")}
            className="hidden h-5 w-4 shrink-0 cursor-grab place-items-center text-muted-foreground group-hover:grid"
            {...attributes}
            {...listeners}
          >
            <DotsSixVertical size={12} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          aria-label={aberta ? t("Recolher") : t("Expandir")}
          aria-expanded={filhas.length ? aberta : undefined}
          onClick={() => acoes.alternar(nota.id)}
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-secondary",
            filhas.length === 0 && "invisible",
          )}
        >
          {aberta ? <CaretDown size={12} aria-hidden /> : <CaretRight size={12} aria-hidden />}
        </button>
        <button
          type="button"
          onClick={() => acoes.abrir(nota.id)}
          aria-current={ativa ? "page" : undefined}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {nota.icon ? (
            <span className="shrink-0 text-sm leading-none">{nota.icon}</span>
          ) : (
            <FileText size={14} className="shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="truncate">{nota.title || t("Sem título")}</span>
          {acoes.podeEditar && nota.visible_to_client ? (
            <Eye size={11} className="shrink-0 text-primary" aria-label={t("Visível ao cliente")} />
          ) : null}
        </button>
        {acoes.podeEditar ? (
          <span className="flex shrink-0 items-center opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              aria-label={t("Nova subpágina")}
              title={t("Nova subpágina")}
              onClick={() => acoes.criar(nota.id)}
              className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus size={12} aria-hidden />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("Mais opções")}
                  className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <DotsThree size={14} weight="bold" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => acoes.criar(nota.id)}>
                  <Plus size={14} aria-hidden /> {t("Nova subpágina")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => acoes.mover(nota.id)}>
                  <ArrowBendUpLeft size={14} aria-hidden /> {t("Mover para…")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => acoes.mudarVisibilidade(nota.id, !nota.visible_to_client)}
                >
                  {nota.visible_to_client ? (
                    <EyeSlash size={14} aria-hidden />
                  ) : (
                    <Eye size={14} aria-hidden />
                  )}
                  {nota.visible_to_client ? t("Esconder do cliente") : t("Liberar ao cliente")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => acoes.apagar(nota.id)}>
                  <Trash size={14} aria-hidden /> {t("Mandar para a lixeira")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ) : null}
      </div>
      {aberta && filhas.length ? <Nivel nos={filhas} nivel={nivel + 1} acoes={acoes} /> : null}
    </li>
  );
}

function Nivel({ nos, nivel, acoes }: { nos: NoDaArvore[]; nivel: number; acoes: Acoes }) {
  return (
    <SortableContext items={nos.map((n) => n.nota.id)} strategy={verticalListSortingStrategy}>
      <ul className="flex flex-col gap-px">
        {nos.map((n) => (
          <Linha key={n.nota.id} no={n} nivel={nivel} acoes={acoes} />
        ))}
      </ul>
    </SortableContext>
  );
}

/**
 * A ÁRVORE de páginas, na lateral: abre e fecha, arrasta para reordenar entre irmãs (as subpáginas
 * ficam dentro da mãe) e cada linha tem "nova subpágina" e o menu (mover, visibilidade, lixeira).
 */
export function ArvoreDeNotas({
  notas,
  selecionada,
  podeEditar,
  abertas,
  aoAlternar,
  aoAbrir,
  aoCriar,
  aoApagar,
  aoMover,
  aoMudarVisibilidade,
  aoReordenar,
}: {
  notas: ResumoDaNota[];
  selecionada: string | null;
  podeEditar: boolean;
  abertas: Set<string>;
  aoAlternar: (id: string) => void;
  aoAbrir: (id: string) => void;
  aoCriar: (parentId: string | null) => void;
  aoApagar: (id: string) => void;
  aoMover: (id: string) => void;
  aoMudarVisibilidade: (id: string, visivel: boolean) => void;
  /** Novas posições (id → posição) depois de um arraste. */
  aoReordenar: (mudancas: Array<{ id: string; position: number }>) => void;
}) {
  const t = useT();
  const vivas = useMemo(() => notas.filter((n) => !n.deleted_at), [notas]);
  const arvore = useMemo(() => montarArvore(vivas), [vivas]);
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function aoSoltar(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ativa = vivas.find((n) => n.id === active.id);
    const alvo = vivas.find((n) => n.id === over.id);
    if (!ativa || !alvo || ativa.parent_id !== alvo.parent_id) return;
    const irmas = vivas
      .filter((n) => n.parent_id === ativa.parent_id)
      .sort((a, b) => a.position - b.position);
    const de = irmas.findIndex((n) => n.id === ativa.id);
    const para = irmas.findIndex((n) => n.id === alvo.id);
    const nova = arrayMove(irmas, de, para);
    const i = nova.findIndex((n) => n.id === ativa.id);
    const antes = nova[i - 1]?.position;
    const depois = nova[i + 1]?.position;
    if (lacunaAcabou(antes, depois)) {
      const posicoes = renumerar(irmas.map((n) => n.position));
      aoReordenar(nova.map((n, k) => ({ id: n.id, position: posicoes[k]! })));
      return;
    }
    aoReordenar([{ id: ativa.id, position: posicaoEntre(antes, depois) }]);
  }

  const acoes: Acoes = {
    selecionada,
    podeEditar,
    abertas,
    alternar: aoAlternar,
    abrir: aoAbrir,
    criar: aoCriar,
    apagar: aoApagar,
    mover: aoMover,
    mudarVisibilidade: aoMudarVisibilidade,
  };

  return (
    <div className="flex flex-col gap-1">
      {podeEditar ? (
        <button
          type="button"
          onClick={() => aoCriar(null)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-card/70 hover:text-foreground"
        >
          <Plus size={14} aria-hidden /> {t("Nova página")}
        </button>
      ) : null}
      {arvore.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          {podeEditar
            ? t("Nenhuma página ainda. Crie a primeira.")
            : t("Nenhuma página foi compartilhada com você ainda.")}
        </p>
      ) : (
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
          <Nivel nos={arvore} nivel={0} acoes={acoes} />
        </DndContext>
      )}
    </div>
  );
}
