"use client";

import {
  closestCenter,
  DndContext,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState, type ReactNode } from "react";

import { useT } from "@/hooks/i18n/useT";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TipoDeVisualizacao } from "@/lib/motor/visualizacoes";
import { CalendarDots, CaretDown, ChartBar, Kanban, Plus, Rows, SquaresFour } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface AbaDeVisualizacao {
  id: string;
  nome: string;
  tipo: TipoDeVisualizacao;
  /** A aba padrão da tela (não é uma visualização salva): fica sempre primeira e não se arrasta. */
  fixa?: boolean;
}

interface Props {
  abas: AbaDeVisualizacao[];
  ativaId: string;
  podeEditar: boolean;
  aoEscolher: (id: string) => void;
  aoCriar: (nome: string, tipo: TipoDeVisualizacao) => void;
  /** Abrir o painel "Configurar visualização" da aba ativa. */
  aoConfigurar: () => void;
  /** Os tipos que a tela sabe desenhar (padrão: todos). */
  tipos?: readonly TipoDeVisualizacao[];
  /** Abas prontas, criadas com um clique no "+" (ex.: o Radar do CRM). */
  modelos?: ReadonlyArray<{ id: string; nome: string; descricao: string }>;
  aoCriarModelo?: (id: string) => void;
  /**
   * Arrastar uma aba para outro lugar: leva `id` para antes de `antesDeId` (`null` = para o fim).
   * Ausente = as abas não se arrastam.
   */
  aoReordenar?: (id: string, antesDeId: string | null) => void;
}

/** O ícone de cada tipo de visualização. */
export function iconeDoTipo(tipo: TipoDeVisualizacao): ReactNode {
  switch (tipo) {
    case "kanban":
      return <Kanban size={14} aria-hidden />;
    case "calendario":
      return <CalendarDots size={14} aria-hidden />;
    case "timeline":
      return <ChartBar size={14} aria-hidden />;
    case "galeria":
      return <SquaresFour size={14} aria-hidden />;
    default:
      return <Rows size={14} aria-hidden />;
  }
}

const TIPOS: TipoDeVisualizacao[] = ["tabela", "kanban", "calendario", "timeline"];

/** Os nomes dos tipos, como a tela os mostra. Fora do componente para o `t()` ficar literal. */
function useRotuloDoTipo() {
  const t = useT();
  return (tipo: TipoDeVisualizacao) =>
    tipo === "tabela"
      ? t("Tabela")
      : tipo === "kanban"
        ? t("Quadro")
        : tipo === "calendario"
          ? t("Calendário")
          : tipo === "galeria"
            ? t("Cards")
            : t("Linha do tempo");
}

/** A moldura de uma aba: arrastável quando `movel`, sempre no lugar quando não. */
function AbaSortavel({
  id,
  movel,
  className,
  children,
}: {
  id: string;
  movel: boolean;
  className: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !movel,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...(movel ? { ...attributes, ...listeners } : {})}
      // O contêiner é só a moldura: a aba continua sendo o botão `tab` dentro dele.
      role={undefined}
      tabIndex={undefined}
      className={cn(className, movel && "cursor-grab", isDragging && "z-10 opacity-70")}
    >
      {children}
    </div>
  );
}

/**
 * As ABAS de visualização, no jeito do Notion: uma pílula por visualização, a ativa em
 * destaque, e um "+" que abre "Nova visualização" (nome + tipo). A fila rola para o lado
 * dentro dela mesma — a página nunca ganha barra de rolagem horizontal.
 *
 * Tocar na aba que JÁ está ativa (ou duplo clique, ou segurar o dedo, ou a setinha ▾) abre
 * "Configurar visualização": nome, tipo e propriedades.
 */
export function AbasDeVisualizacao({
  abas,
  ativaId,
  podeEditar,
  aoEscolher,
  aoCriar,
  aoConfigurar,
  tipos = TIPOS,
  modelos = [],
  aoCriarModelo,
  aoReordenar,
}: Props) {
  const t = useT();
  const rotuloDoTipo = useRotuloDoTipo();
  const [novaAberta, setNovaAberta] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoDeVisualizacao>("tabela");
  const segurando = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abriuSegurando = useRef(false);

  // Arrastar com o mouse (um clique solto continua escolhendo a aba): a aba padrão fica de fora.
  const sensores = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }));
  const podeArrastar = podeEditar && Boolean(aoReordenar);
  const idsMoveis = abas.filter((a) => !a.fixa).map((a) => a.id);
  function aoSoltar(e: DragEndEvent) {
    if (!aoReordenar || !e.over || e.active.id === e.over.id) return;
    const de = idsMoveis.indexOf(String(e.active.id));
    const para = idsMoveis.indexOf(String(e.over.id));
    if (de < 0 || para < 0) return;
    const nova = arrayMove(idsMoveis, de, para);
    const k = nova.indexOf(String(e.active.id));
    aoReordenar(String(e.active.id), nova[k + 1] ?? null);
  }

  function criar() {
    aoCriar(nome.trim() || rotuloDoTipo(tipo), tipo);
    setNovaAberta(false);
    setNome("");
    setTipo("tabela");
  }

  return (
    <div
      role="tablist"
      aria-label={t("Visualizações")}
      className="-mx-1 flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden"
    >
      <DndContext
        id="abas-de-visualizacao"
        sensors={sensores}
        collisionDetection={closestCenter}
        modifiers={[({ transform }) => ({ ...transform, y: 0 })]}
        onDragEnd={aoSoltar}
      >
        <SortableContext items={idsMoveis} strategy={horizontalListSortingStrategy}>
          {abas.map((aba) => {
            const ativa = aba.id === ativaId;
            return (
              <AbaSortavel
                key={aba.id}
                id={aba.id}
                movel={podeArrastar && !aba.fixa}
                className={cn(
                  "flex h-8 shrink-0 items-center rounded-lg text-sm transition-colors",
                  ativa
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => {
                    if (abriuSegurando.current) {
                      abriuSegurando.current = false;
                      return;
                    }
                    if (!ativa) aoEscolher(aba.id);
                    else aoConfigurar();
                  }}
                  onDoubleClick={() => {
                    if (ativa) aoConfigurar();
                  }}
                  onPointerDown={(e) => {
                    if (!ativa || e.pointerType !== "touch") return;
                    // Segurar o dedo na aba ativa também abre a configuração.
                    segurando.current = setTimeout(() => {
                      abriuSegurando.current = true;
                      aoConfigurar();
                    }, 500);
                  }}
                  onPointerUp={() => clearTimeout(segurando.current)}
                  onPointerLeave={() => clearTimeout(segurando.current)}
                  onPointerCancel={() => clearTimeout(segurando.current)}
                  onContextMenu={(e) => {
                    if (ativa) e.preventDefault();
                  }}
                  className={cn(
                    "flex h-8 max-w-48 items-center gap-1.5 rounded-lg pl-2.5 select-none",
                    ativa ? "pr-1" : "pr-2.5",
                  )}
                >
                  {iconeDoTipo(aba.tipo)}
                  <span className="truncate">{aba.nome}</span>
                </button>
                {ativa ? (
                  <button
                    type="button"
                    aria-label={t("Configurar visualização")}
                    title={t("Configurar visualização")}
                    onClick={aoConfigurar}
                    className="grid h-8 w-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <CaretDown size={12} weight="bold" aria-hidden />
                  </button>
                ) : null}
              </AbaSortavel>
            );
          })}
        </SortableContext>
      </DndContext>

      {podeEditar ? (
        <Popover open={novaAberta} onOpenChange={setNovaAberta}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("Nova visualização")}
              title={t("Nova visualização")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Plus size={16} weight="bold" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(92vw,320px)] p-3">
            {modelos.length > 0 && aoCriarModelo ? (
              <div className="mb-3 border-b pb-3">
                <p className="mb-1.5 text-xs font-semibold tracking-wider text-text-subtle uppercase">
                  {t("Prontas")}
                </p>
                {modelos.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      aoCriarModelo(m.id);
                      setNovaAberta(false);
                    }}
                    className="block w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="block text-sm font-medium">{t(m.nome)}</span>
                    <span className="block text-xs text-muted-foreground">{t(m.descricao)}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <p className="mb-2 text-sm font-semibold">{t("Nova visualização")}</p>
            <input
              value={nome}
              maxLength={60}
              placeholder={rotuloDoTipo(tipo)}
              aria-label={t("Nome da visualização")}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") criar();
              }}
              className="h-9 w-full rounded-lg border bg-card px-2.5 text-sm outline-hidden focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            <div
              className="mt-2 grid grid-cols-2 gap-1.5"
              role="radiogroup"
              aria-label={t("Tipo de visualização")}
            >
              {tipos.map((x) => (
                <button
                  key={x}
                  type="button"
                  role="radio"
                  aria-checked={tipo === x}
                  onClick={() => setTipo(x)}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors",
                    tipo === x ? "border-primary bg-primary/10 font-medium" : "hover:bg-secondary",
                  )}
                >
                  {iconeDoTipo(x)}
                  {rotuloDoTipo(x)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={criar}
              className="mt-3 h-9 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              {t("Criar visualização")}
            </button>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
