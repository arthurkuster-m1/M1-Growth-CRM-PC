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
import { useId, useState, type ReactNode } from "react";

import { ICONE_DO_TIPO } from "@/components/motor/AbasDeVisualizacao";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/hooks/i18n/useT";
import { useCelular } from "@/hooks/motor/useCelular";
import type { TipoDeVisualizacao } from "@/lib/motor/visualizacoes";
import { CaretDown, CaretUp, Copy, DotsSixVertical, Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface PropriedadeDaConfiguracao {
  id: string;
  titulo: string;
  icone?: ReactNode;
  visivel: boolean;
  /** Sempre visível (o título): pode mudar de lugar, não pode ser escondida. */
  obrigatoria?: boolean;
}

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  nome: string;
  tipo: TipoDeVisualizacao;
  podeEditar: boolean;
  /** A visualização de fábrica não muda de tipo e não se apaga. */
  ehPadrao: boolean;
  aoRenomear: (nome: string) => void;
  aoTrocarTipo: (tipo: TipoDeVisualizacao) => void;
  /** As propriedades, na ordem em que aparecem. Vazio: o tipo não usa propriedades. */
  propriedades: PropriedadeDaConfiguracao[];
  /** Arrastou `idMovido` para a posição de `idAlvo`. */
  aoMover: (idMovido: string, idAlvo: string) => void;
  aoAlternar: (id: string) => void;
  aoMostrarTodas: (mostrar: boolean) => void;
  aoDuplicar?: () => void;
  aoApagar?: () => void;
}

const TIPOS: TipoDeVisualizacao[] = ["tabela", "kanban", "calendario", "timeline"];
const soVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function useRotuloDoTipo() {
  const t = useT();
  return (tipo: TipoDeVisualizacao) =>
    tipo === "tabela"
      ? t("Tabela")
      : tipo === "kanban"
        ? t("Quadro")
        : tipo === "calendario"
          ? t("Calendário")
          : t("Linha do tempo");
}

/**
 * CONFIGURAR VISUALIZAÇÃO — o painel que abre ao clicar na aba ativa (como "Ver
 * configurações da visualização" do Notion). Tem o nome, o tipo e as PROPRIEDADES: quais
 * aparecem e em que ordem. Vale para qualquer visualização, a de fábrica inclusive.
 *
 * A ordem muda de três jeitos, para funcionar com mouse, teclado e dedo: arrastando a alça,
 * com as setas ↑↓ ao lado de cada propriedade, ou arrastando o cabeçalho na própria tabela.
 *
 * Só desenha e avisa; quem guarda é a tela (a configuração da aba ou o layout pessoal).
 */
export function ConfigurarVisualizacao(props: Props) {
  const celular = useCelular();
  const t = useT();
  const { aberto, aoFechar } = props;

  const corpo = <Corpo {...props} />;

  if (celular) {
    return (
      <Sheet open={aberto} onOpenChange={(a) => !a && aoFechar()}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] gap-3 overflow-y-auto rounded-t-3xl p-4 pb-8"
        >
          <SheetTitle className="text-center text-base font-semibold">
            {t("Configurar visualização")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("Nome, tipo e propriedades da visualização")}
          </SheetDescription>
          {corpo}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[88dvh] max-w-md gap-4 overflow-y-auto p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">
          {t("Configurar visualização")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t("Nome, tipo e propriedades da visualização")}
        </DialogDescription>
        {corpo}
      </DialogContent>
    </Dialog>
  );
}

function Corpo({
  nome,
  tipo,
  podeEditar,
  ehPadrao,
  aoRenomear,
  aoTrocarTipo,
  propriedades,
  aoMover,
  aoAlternar,
  aoMostrarTodas,
  aoDuplicar,
  aoApagar,
  aoFechar,
}: Props) {
  const t = useT();
  const rotuloDoTipo = useRotuloDoTipo();
  const idDoDnd = useId();
  const [rascunho, setRascunho] = useState(nome);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function salvarNome() {
    const novo = rascunho.trim();
    if (novo && novo !== nome) aoRenomear(novo);
    else setRascunho(nome);
  }

  function aoSoltar({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) aoMover(String(active.id), String(over.id));
  }

  const opcionais = propriedades.filter((p) => !p.obrigatoria);
  const todasLigadas = opcionais.every((p) => p.visivel);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <label htmlFor="nome-da-visualizacao" className="mb-1 block text-xs text-muted-foreground">
          {t("Nome da visualização")}
        </label>
        <input
          id="nome-da-visualizacao"
          value={rascunho}
          maxLength={60}
          readOnly={!podeEditar}
          onChange={(e) => setRascunho(e.target.value)}
          onBlur={salvarNome}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-11 w-full rounded-xl border bg-background px-3 text-base outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {!ehPadrao && podeEditar ? (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{t("Tipo de visualização")}</p>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
            {TIPOS.map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={tipo === x}
                onClick={() => tipo !== x && aoTrocarTipo(x)}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors",
                  tipo === x ? "border-primary bg-primary/10 font-medium" : "hover:bg-secondary",
                )}
              >
                {ICONE_DO_TIPO[x]}
                {rotuloDoTipo(x)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {propriedades.length > 0 ? (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t("Propriedades")}</p>
            {opcionais.length > 0 ? (
              <button
                type="button"
                onClick={() => aoMostrarTodas(!todasLigadas)}
                className="rounded-md px-2 py-1 text-xs text-primary hover:bg-secondary"
              >
                {todasLigadas ? t("Ocultar todas") : t("Mostrar todas")}
              </button>
            ) : null}
          </div>
          <DndContext
            id={idDoDnd}
            sensors={sensores}
            collisionDetection={closestCenter}
            modifiers={[soVertical]}
            onDragEnd={aoSoltar}
          >
            <SortableContext
              items={propriedades.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="divide-y rounded-2xl bg-secondary/60">
                {propriedades.map((p, i) => (
                  <Linha
                    key={p.id}
                    propriedade={p}
                    primeira={i === 0}
                    ultima={i === propriedades.length - 1}
                    podeEditar={podeEditar}
                    aoAlternar={() => aoAlternar(p.id)}
                    aoSubir={() => aoMover(p.id, propriedades[i - 1]!.id)}
                    aoDescer={() => aoMover(p.id, propriedades[i + 1]!.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
          {t("Esta visualização usa as datas da tarefa; não há propriedades para escolher.")}
        </p>
      )}

      {podeEditar && !ehPadrao && (aoDuplicar || aoApagar) ? (
        <div className="divide-y rounded-2xl bg-secondary/60">
          {aoDuplicar ? (
            <button
              type="button"
              onClick={() => {
                aoDuplicar();
                aoFechar();
              }}
              className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm hover:bg-secondary"
            >
              <Copy size={14} aria-hidden />
              {t("Duplicar")}
            </button>
          ) : null}
          {aoApagar ? (
            <button
              type="button"
              onClick={() => {
                aoApagar();
                aoFechar();
              }}
              className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-sm text-error-fg hover:bg-secondary"
            >
              <Trash size={14} aria-hidden />
              {t("Apagar visualização")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Linha({
  propriedade,
  primeira,
  ultima,
  podeEditar,
  aoAlternar,
  aoSubir,
  aoDescer,
}: {
  propriedade: PropriedadeDaConfiguracao;
  primeira: boolean;
  ultima: boolean;
  podeEditar: boolean;
  aoAlternar: () => void;
  aoSubir: () => void;
  aoDescer: () => void;
}) {
  const t = useT();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: propriedade.id, disabled: !podeEditar });
  const ligada = propriedade.obrigatoria || propriedade.visivel;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex min-h-12 items-center gap-1 bg-transparent px-2",
        isDragging && "relative z-10 rounded-xl bg-card shadow-lg ring-1 ring-primary/30",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        disabled={!podeEditar}
        aria-label={`${t("Arrastar para reordenar")}: ${propriedade.titulo}`}
        className="grid h-9 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-text-subtle hover:bg-secondary active:cursor-grabbing disabled:opacity-40"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={18} weight="bold" aria-hidden />
      </button>
      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="text-muted-foreground">{propriedade.icone}</span>
        <span className={cn("truncate", !ligada && "text-muted-foreground")}>
          {propriedade.titulo}
        </span>
      </span>
      {podeEditar ? (
        <>
          <button
            type="button"
            disabled={primeira}
            aria-label={`${t("Mover para cima")}: ${propriedade.titulo}`}
            onClick={aoSubir}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
          >
            <CaretUp size={14} aria-hidden />
          </button>
          <button
            type="button"
            disabled={ultima}
            aria-label={`${t("Mover para baixo")}: ${propriedade.titulo}`}
            onClick={aoDescer}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
          >
            <CaretDown size={14} aria-hidden />
          </button>
        </>
      ) : null}
      <Switch
        checked={ligada}
        disabled={!podeEditar || propriedade.obrigatoria}
        aria-label={propriedade.titulo}
        onCheckedChange={aoAlternar}
        className="ml-1"
      />
    </li>
  );
}
